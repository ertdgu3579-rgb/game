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
            l: false // 점프 키 추가
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
    }

    // 특정 키가 현재 눌려져 있는지 확인하는 함수
    isPressed(key) {
        return this.keys[key];
    }
}

/**
 * 2. Player: 플레이어 메쉬(3D 모델)와 움직임/물리 엔진을 담당하는 클래스
 */
class Player {
    constructor(scene, inputManager) {
        this.input = inputManager;
        this.speed = 0.2;
        
        // 점프를 위한 물리 연산 속성
        this.jumpForce = 0.35; // 위로 밀어올리는 힘
        this.gravity = -0.015; // 아래로 끌어당기는 중력 
        this.velocityY = 0;    // 현재 y축(수직) 속도
        this.isOnGround = true; // 현재 땅에 닿아있는가?
        this.groundLevel = 1;   // 플레이어가 바닥에 서있을 때의 높이 기준점
        
        // 플레이어 캐릭터 생성 (정육면체)
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0xFF8C00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = this.groundLevel;
        
        scene.add(this.mesh); // 장면에 플레이어 추가
    }

    // 매 프레임마다 플레이어의 상태를 갱신
    update() {
        // [1] 평면(X, Z) 이동 로직
        if (this.input.isPressed('w')) this.mesh.position.z -= this.speed;
        if (this.input.isPressed('s')) this.mesh.position.z += this.speed;
        if (this.input.isPressed('a')) this.mesh.position.x -= this.speed;
        if (this.input.isPressed('d')) this.mesh.position.x += this.speed;

        // [2] 점프 로직 (L 키를 누르고 있고, 땅에 닿아있을 때만 가능)
        if (this.input.isPressed('l') && this.isOnGround) {
            this.velocityY = this.jumpForce;
            this.isOnGround = false;
        }

        // [3] 중력 및 수직 위치 갱신
        if (!this.isOnGround) {
            this.velocityY += this.gravity; // 공중에 있으면 중력이 계속 누적됨
            this.mesh.position.y += this.velocityY; // 현재 수직 속도만큼 이동

            // 바닥 충돌 검사 (땅에 떨어졌을 때)
            if (this.mesh.position.y <= this.groundLevel) {
                this.mesh.position.y = this.groundLevel;
                this.velocityY = 0;
                this.isOnGround = true; // 다시 점프 가능 상태로 복귀
            }
        }
    }
}

/**
 * 3. Game: 전체 환경 세팅과 게임 루프 제어, 다른 클래스들의 생성을 지휘하는 마스터 클래스
 */
class Game {
    constructor() {
        this.initScene();
        this.initLights();
        this.initEnvironment();

        // 관리자 클래스들 생성 (의존성 주입)
        this.inputManager = new InputManager();
        this.player = new Player(this.scene, this.inputManager);

        this.handleResize();

        // requestAnimationFrame에서 this를 올바르게 가리키기 위해 범위 바인딩
        this.animate = this.animate.bind(this);
        this.animate(); // 게임 시작
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // 하늘색 배경

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        // 플레이어보다 약간 뒤, 위에서 대각선으로 내려다보는 기본 위치 구도를 잡습니다.
        this.camera.position.set(0, 10, 15);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true }); // 계단현상 방지
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }

    initLights() {
        // 주변광 (그림자가 닿지 않는 어두운 부분도 기본적으로 밝게 해줌)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // 방향광 (태양과 같이 특정 방향에서 내리쬐는 빛)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
    }

    initEnvironment() {
        // 바닥 평면 생성
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); // 짙은 녹색
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // 평면을 90도 눕혀서 바닥으로 만듦
        this.scene.add(ground);
    }

    updateCamera() {
        // 카메라가 플레이어를 부드럽게 추적하도록 X, Z 위치만 맞춰 동기화
        this.camera.position.x = this.player.mesh.position.x;
        this.camera.position.z = this.player.mesh.position.z + 15;
    }

    handleResize() {
        // 브라우저 창 크기가 변할 때 화면이 깨지거나 비율이 찌그러지는 것을 방지
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // 메인 게임 루프 - 모니터 주사율에 맞춰 초당 약 60회 실행됨
    animate() {
        requestAnimationFrame(this.animate);
        
        // 1. 플레이어 계산 업데이트
        this.player.update();
        
        // 2. 변경된 플레이어 위치에 맞춰 카메라 위치 업데이트
        this.updateCamera();

        // 3. 계산된 모든 정보를 바탕으로 화면에 그리기
        this.renderer.render(this.scene, this.camera);
    }
}

// 웹 페이지의 요소들이 모두 로드되면 Game 클래스 인스턴스를 하나 찍어내서 게임 구동!
window.onload = () => {
    new Game();
};
