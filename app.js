const buttons = document.querySelectorAll(".btn");

buttons.forEach((button) => {

    button.addEventListener("click", () => {

        window.location.href = button.dataset.link; //병원 탐색 페이지로 이동

    });

});

const year = document.getElementById("dateInput1");
const month = document.getElementById("dateInput2");
const day = document.getElementById("dateInput3");

function checkInput() {

    if (
        year.value.length === 4 &&
        month.value.length === 2 &&
        day.value.length === 2
    ) {

        window.location.href = "time.html";

    }

}

// 숫자만 허용 + 검사
[year, month, day].forEach((input) => {

    input.addEventListener("input", () => {

        input.value = input.value.replace(/[^0-9]/g, '');

        checkInput();

    });

});
const submitBtn = document.getElementById("complete");
const message = document.getElementById("message");

submitBtn.onclick = function () {

    message.readOnly = false;

    message.focus();

};