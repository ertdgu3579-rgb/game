const buttons = document.querySelectorAll(".btn");

const pages = {
    mainPage: document.getElementById("mainPage"),
    hospitalPage: document.getElementById("hospitalPage"),
    informationPage: document.getElementById("informationPage"),
    dayPage: document.getElementById("dayPage"),
    timePage: document.getElementById("timePage"),
    inventoryPage: document.getElementById("inventoryPage"),
    inputPage: document.getElementById("inputPage"),
    mapPage: document.getElementById("mapPage")
};

function changePage(targetPageId) {
    Object.values(pages).forEach(page => {
        if (page && page.classList) {
            page.classList.remove("active");
        }
    });

    if (pages[targetPageId] && pages[targetPageId].classList) {
        pages[targetPageId].classList.add("active");
    }
}

buttons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (target) {
            changePage(target);
        }
    });
});

const year = document.getElementById("dateInput1");
const month = document.getElementById("dateInput2");
const day = document.getElementById("dateInput3");

function checkInput() {
    if (year && month && day) {
        if (
            year.value.length === 4 &&
            month.value.length === 2 &&
            day.value.length === 2
        ) {
            changePage("timePage");
        }
    }
}

[year, month, day].forEach((input) => {
    if (input) {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/[^0-9]/g, '');
            checkInput();
        });
    }
});

const submitBtn = document.getElementById("complete");
const message = document.getElementById("message");

if (submitBtn && message) {
    submitBtn.onclick = function () {
        message.readOnly = false;
        message.focus();
    };
}