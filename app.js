/**
 * 1. InputManager: 사용자의 키보드 입력을 전문적으로 처리하는 클래스
 */
class InputManager {
    constructor() {
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            l: false,
            o: false // 공격 키 추가
        };

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }
        });

        // 윈도우 포커스를 잃을 때(Alt+Tab 등) 계속 눌려있는 버그 방지
        window.addEventListener('blur', () => {
            for (let k in this.keys) {
                this.keys[k] = false;
            }
        });
    }

    isPressed(key) {
        return this.keys[key];
    }
}

/**
 * 2. TargetDummy (샌드백 객체)
 */
class TargetDummy {
    constructor(scene) {
        // 플레이어보다 약간 크고 긴 회색 큐브 생성
        const geometry = new THREE.BoxGeometry(2, 4, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // 기본 회색
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.groundLevel = 2; // y=2 에 놓아야 길이 4인 상자가 바닥과 맞닿음
        this.mesh.position.set(0, this.groundLevel, -10); // 등 뒤쪽보단 보통 앞을 보고 가니 z를 -10 앞에 배치
        this.basePosition = this.mesh.position.clone();
        
        scene.add(this.mesh);

        this.shakeFrames = 0; // 타격 피드백 진동 타이머
    }

    takeHit() {
        // 맞는 순간에 진동 시작 (+빨갛게 깜빡임)
        if (this.shakeFrames <= 0) {
            this.shakeFrames = 20; 
            this.mesh.material.color.setHex(0xFF0000); 
        }
    }

    update() {
        if (this.shakeFrames > 0) {
            this.shakeFrames--;
            
            // X, Z 방향으로 무작위 좌표 오프셋을 생성해 "부들부들" 떨리게 함 (파이프라인: 진폭 축소)
            const intensity = this.shakeFrames / 25;
            // 더 강하게 흔들리도록 진폭 증가 (0.8 -> 2.0)
            const offsetX = (Math.random() - 0.5) * 2.0 * intensity;
            const offsetZ = (Math.random() - 0.5) * 2.0 * intensity;
            
            this.mesh.position.set(
                this.basePosition.x + offsetX,
                this.basePosition.y,
                this.basePosition.z + offsetZ
            );

            // 진동 연출이 완전히 끝나면 원래의 회색/제자리로 복구
            if (this.shakeFrames <= 0) {
                this.mesh.position.copy(this.basePosition);
                this.mesh.material.color.setHex(0x808080);
            }
        }
    }
}

/**
 * 3. Player: 3D 캐릭터 및 공격 점프 모델링
 */
class Player {
    constructor(scene, inputManager) {
        this.input = inputManager;
        this.speed = 0.2;
        
        // 점프를 위한 속성
        this.jumpForce = 0.35; 
        this.gravity = -0.015; 
        this.velocityY = 0;    
        this.isOnGround = true; 
        this.groundLevel = 1;   
        
        // 애니메이션 추가 상태 
        this.isPreparingJump = false;
        this.jumpSquashFrames = 0;

        // 공격 관련 신규 속성들
        this.facingAngle = 0; // 캐릭터가 바라보고 있는 현재 각도
        this.isPreparingAttack = false; // 공격용 누적 찌그러짐 상태
        this.attackSquashFrames = 0;
        this.isAttacking = false; // "공격 체공 상태" 즉 돌진 중인지
        this.attackVelocityX = 0;
        this.attackVelocityZ = 0;
        this.hasHitThisAttack = false; // 다단 히트 방지용

        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0xFF8C00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = this.groundLevel;
        
        scene.add(this.mesh); 
    }

    // AABB 충돌 검사를 위해 현재 메쉬 박스의 크기 정보를 내뱉는 유틸함수
    getBoundingBox() {
        return new THREE.Box3().setFromObject(this.mesh);
    }

    update() {
        // [0] 맵 범위를 벗어났는지 확인 (100x100 평면 기준: x와 z가 -50 ~ 50 사이)
        if (Math.abs(this.mesh.position.x) > 50 || Math.abs(this.mesh.position.z) > 50) {
            this.groundLevel = -1000; // 바닥이 벗어났으므로 한없이 아래로 떨어지게 만듦
            this.isOnGround = false;  // 강제 체공 상태
        } else {
            this.groundLevel = 1;     // 안전 영역에서는 정상 바닥
        }

        // 추락사 판정 및 리스폰
        if (this.mesh.position.y < -20) {
            this.mesh.position.set(0, 1, 0); // 시작 위치로 복귀
            this.velocityY = 0;
            this.attackVelocityX = 0;
            this.attackVelocityZ = 0;
            this.isOnGround = true;
            this.isAttacking = false;
            this.isPreparingAttack = false;
            this.isPreparingJump = false;
            this.mesh.scale.set(1, 1, 1);
        }

        // [우선순위 1] 공격 발사 중(비행 상태)일 경우 일반 WASD 무시
        if (this.isAttacking) {
            // 정해진 발사각(수직, 수평)으로만 밀고 감
            this.mesh.position.x += this.attackVelocityX;
            this.mesh.position.z += this.attackVelocityZ;
            
            // 중력 적용
            this.velocityY += this.gravity;
            this.mesh.position.y += this.velocityY;

            // 바닥에 부딪히면 돌진 종료
            if (this.mesh.position.y <= this.groundLevel) {
                this.mesh.position.y = this.groundLevel;
                this.velocityY = 0;
                this.isOnGround = true;
                this.isAttacking = false; // 공격 종료! 컨트롤 회복
                this.mesh.scale.set(1, 1, 1);
            }
            return; // 평시 로직 스킵
        }

        // [1] 평면 이동 및 각도 저장
        let moveX = 0;
        let moveZ = 0;

        if (this.input.isPressed('w')) moveZ -= this.speed;
        if (this.input.isPressed('s')) moveZ += this.speed;
        if (this.input.isPressed('a')) moveX -= this.speed;
        if (this.input.isPressed('d')) moveX += this.speed;

        // 기를 모으고 있지 않을 때만 움직일 수 있음
        if (!this.isPreparingAttack && !this.isPreparingJump) {
            this.mesh.position.x += moveX;
            this.mesh.position.z += moveZ;

            // 각도 업데이트 (바라보는 방향)
            if (moveX !== 0 || moveZ !== 0) {
                this.facingAngle = Math.atan2(moveX, moveZ);
                const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facingAngle);
                this.mesh.quaternion.slerp(targetQuaternion, 0.15); 
            }
        }

        // [2] O키 공격 준비(오발 방지: 땅에 있을때, 점프 중이 아닐때)
        if (this.input.isPressed('o') && this.isOnGround && !this.isPreparingAttack && !this.isPreparingJump) {
            this.isPreparingAttack = true;
            this.attackSquashFrames = 6; // 선딜레이(준비시간)을 10 -> 6으로 줄여 더 빠릿한 공격 속도
        }

        if (this.isPreparingAttack) {
            if (this.attackSquashFrames > 0) {
                this.attackSquashFrames--;
                const progress = this.attackSquashFrames / 6;
                
                // 점프 준비보다 공격 준비는 좀 더 과장되게 눌림을 준다
                this.mesh.scale.y = 0.5 + 0.5 * progress; 
                this.mesh.scale.x = 1.5 - 0.5 * progress;
                this.mesh.scale.z = 1.5 - 0.5 * progress;
                this.mesh.position.y = this.groundLevel * this.mesh.scale.y; 
            } else {
                // 발사 - (돌진 속도감을 좀 더 올림 1.5 -> 1.8배)
                this.isPreparingAttack = false;
                this.isOnGround = false;
                this.isAttacking = true;
                this.hasHitThisAttack = false; // 적 타격 시도용 변수 리셋
                
                const dashSpeed = this.speed * 1.8;
                
                // 이전 facingAngle을 바탕으로 삼각함수로 밀어냄
                this.attackVelocityX = Math.sin(this.facingAngle) * dashSpeed;
                this.attackVelocityZ = Math.cos(this.facingAngle) * dashSpeed;
                
                // 몸 크기의 약 2배인 즉 4 거리를 가도록, 앞으로 나가는 속력의 1배 정도를 수직 속도로 세팅 
                // 수평/수직 벡터 크기가 같아지면서 약 45도의 포물선을 그림
                this.velocityY = dashSpeed; 
                
                this.mesh.scale.set(1, 1, 1);
                this.mesh.position.y = this.groundLevel;
            }
        }

        // [3] 기존 L키 점프 준비 연산 (공격중이 아닐 경우)
        if (!this.isPreparingAttack && this.input.isPressed('l') && this.isOnGround && !this.isPreparingJump) {
            this.isPreparingJump = true;
            this.jumpSquashFrames = 10;
        }

        if (this.isPreparingJump) {
            if (this.jumpSquashFrames > 0) {
                this.jumpSquashFrames--;
                const progress = this.jumpSquashFrames / 10;
                this.mesh.scale.y = 0.6 + 0.4 * progress; 
                this.mesh.scale.x = 1.4 - 0.4 * progress;
                this.mesh.scale.z = 1.4 - 0.4 * progress;
                this.mesh.position.y = this.groundLevel * this.mesh.scale.y; 
            } else {
                this.isPreparingJump = false;
                this.velocityY = this.jumpForce;
                this.isOnGround = false;
                this.mesh.scale.set(1, 1, 1);
                this.mesh.position.y = this.groundLevel;
            }
        }

        // [4] 공격 외 일반 중력 낙하 처리
        if (!this.isOnGround && !this.isAttacking) {
            this.velocityY += this.gravity; 
            this.mesh.position.y += this.velocityY; 

            if (this.mesh.position.y <= this.groundLevel) {
                this.mesh.position.y = this.groundLevel;
                this.velocityY = 0;
                this.isOnGround = true; 
            }
        }
    }
}

/**
 * 4. Game: 충돌 검사와 카메라 연출 통합
 */
class Game {
    constructor() {
        // 화면 전역 정지 타이머 (밀리초 단위 기록)
        this.globalHitStopEnd = 0;
        // 카메라 진동을 위한 베이스 좌표
        this.cameraShakeTimer = 0;
        this.baseCameraPos = new THREE.Vector3(0, 10, 15);

        this.initScene();
        this.initLights();
        this.initEnvironment();

        this.inputManager = new InputManager();
        this.player = new Player(this.scene, this.inputManager);
        this.dummy = new TargetDummy(this.scene); // 맵에 샌드백스폰!

        this.handleResize();
        this.animate = this.animate.bind(this);
        this.animate(); 
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); 

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.copy(this.baseCameraPos);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true }); 
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
    }

    initEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); 
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; 
        this.scene.add(ground);
    }

    updateCamera() {
        // [기본 이상적인 추적 지점]
        const targetX = this.player.mesh.position.x;
        const targetZ = this.player.mesh.position.z + 15;

        // 베이스 좌표가 스무스하게 쫓아감
        this.baseCameraPos.x += (targetX - this.baseCameraPos.x) * 0.1;
        this.baseCameraPos.z = targetZ; // 거리는 지연 없이 따라감
        this.baseCameraPos.y = 10; // 높이 고정

        // [화면 흔들림 연산]
        let shakeOffset = new THREE.Vector3(0,0,0);
        if (this.cameraShakeTimer > 0) {
            this.cameraShakeTimer--;
            const intensity = this.cameraShakeTimer / 10; 
            shakeOffset.x = (Math.random() - 0.5) * 2.0 * intensity;
            shakeOffset.y = (Math.random() - 0.5) * 2.0 * intensity;
        }

        // 베이스 좌표에 쉐이크(진동) 덧셈
        this.camera.position.copy(this.baseCameraPos).add(shakeOffset);
    }

    checkCollisions() {
        const playerBox = this.player.getBoundingBox();
        const dummyBox = new THREE.Box3().setFromObject(this.dummy.mesh);

        // 상자와 플레이어가 겹쳤을 때
        if (playerBox.intersectsBox(dummyBox)) {
            // [1] 물리적인 겹침 관통 방지 연산 (Solid 밀어내기)
            // 어느 쪽 면으로 덜 겹쳤는지 찾아내어 그 축으로 밀어냅니다.
            const dx1 = dummyBox.max.x - playerBox.min.x;
            const dx2 = playerBox.max.x - dummyBox.min.x;
            const dz1 = dummyBox.max.z - playerBox.min.z;
            const dz2 = playerBox.max.z - dummyBox.min.z;
            
            const overlapX = dx1 < dx2 ? dx1 : -dx2;
            const overlapZ = dz1 < dz2 ? dz1 : -dz2;
            
            // 두 겹침 양 중 수치가 더 작은 방향으로만 밀어냄
            if (Math.abs(overlapX) < Math.abs(overlapZ)) {
                this.player.mesh.position.x += overlapX;
            } else {
                this.player.mesh.position.z += overlapZ;
            }

            // AABB(바운딩 박스)가 즉시 위치가 수정되었으므로 갱신
            playerBox.setFromObject(this.player.mesh);


            // [2] 공격 타격 처리 (관통되지 않고 멈추며 떨어지게)
            if (this.player.isAttacking) {
                // 이번 공격의 첫 명중일 때만 타격 이펙트 발생
                if (!this.player.hasHitThisAttack) {
                    this.dummy.takeHit(); 
                    this.cameraShakeTimer = 22; // 카메라 흔들림을 더 날카롭고 묵직하게
                    this.player.hasHitThisAttack = true; 
                    
                    // 더 빠르고 경쾌한 타격감을 위해 멈춤 시간을 120ms(0.12초)로 단축 
                    this.globalHitStopEnd = performance.now() + 120;
                }

                // 타격 시 공중으로 천천히 계속 올라가는 현상을 차단하고, 완전 정지 후 툭 떨어지도록 모든 속도를 0으로 셋팅
                this.player.attackVelocityX = 0;
                this.player.attackVelocityZ = 0;
                this.player.velocityY = 0; // 수직 속도까지 지워서 오르막 궤도 강제 캔슬
            }
        }
    }

    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(this.animate);
        
        // 화면 전역 정지(히트스탑) 모드일 경우: 카메라 진동만 처리하고 모든 게임 로직(플레이어/상자 이동)을 동결!
        if (performance.now() < this.globalHitStopEnd) {
            this.updateCamera();
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // 각각 객체 프레임 업데이트
        this.player.update();
        this.dummy.update();

        // 충돌 룰 처리
        this.checkCollisions();
        
        // 그 후 카메라 반영 및 렌더
        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }
}

window.onload = () => {
    new Game();
};
