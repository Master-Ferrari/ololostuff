document.addEventListener('wheel', (e) => {
    e.preventDefault();
}, { passive: false });

const content = document.getElementById('content');

class Scroller {
    static isScrolling = false;

    constructor(speed) {
        this.speed = speed;
        this.intervalId = null;

        console;
    }

    start(buttonEl) {
        if (Scroller.isScrolling) return;
        Scroller.isScrolling = true;
        buttonEl.classList.add('pressed');
        this.intervalId = setInterval(() => {
            content.scrollBy({
                top: this.speed / 2,
                left: 0,
                behavior: 'auto'
            });
        }, 15);
        buttonEl.style.transform = 'scale(1.05)';
    }

    stop(buttonEl) {
        if (!Scroller.isScrolling) return;
        clearInterval(this.intervalId);
        buttonEl.classList.remove('pressed');
        Scroller.isScrolling = false;
        buttonEl.style.transform = 'scale(1.0)';
    }
}

const fastUpBtn = document.getElementById('scrollFastUp');
const slowUpBtn = document.getElementById('scrollUp');
const slowDownBtn = document.getElementById('scrollDown2');
const fastDownBtn = document.getElementById('scrollFastDown');

const fastUpScroller = new Scroller(-15);
const slowUpScroller = new Scroller(-2);
const slowDownScroller = new Scroller(2);
const fastDownScroller = new Scroller(15);

function setupScrollButton(button, scroller) {
    button.addEventListener('mousedown', () => {
        console.log('mousedown on', button.id);
        scroller.start(button);
    });
    button.addEventListener('mouseup', () => {
        console.log('mouseup on', button.id);
        scroller.stop(button);
    });
    button.addEventListener('mouseleave', () => {
        console.log('mouseleave on', button.id);
        scroller.stop(button);
    });
    button.addEventListener('click', () => {
        console.log('click on', button.id);
        scroller.stop(button);
    });

    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        console.log('touchstart on', button.id);
        scroller.start(button);
    });

    button.addEventListener('touchend', () => {
        console.log('touchend on', button.id);
        scroller.stop(button);
    });
    button.addEventListener('touchcancel', () => {
        console.log('touchcancel on', button.id);
        scroller.stop(button);
    });
}

setupScrollButton(fastUpBtn, fastUpScroller);
setupScrollButton(slowUpBtn, slowUpScroller);
setupScrollButton(slowDownBtn, slowDownScroller);
setupScrollButton(fastDownBtn, fastDownScroller);



const desiredWidth = 500;
const fakeControlsEl = document.getElementById('fake-controls');
const controlsEl = document.getElementById('controls');
const contentEl = document.getElementById('content');
const mainEl = document.getElementById('main');
function adjustScale() {
    const currentWidth = Math.min(screen.width, window.innerWidth);
    const currentHeight = Math.min(screen.height, window.innerHeight);

    const contentWidth = contentEl.getBoundingClientRect().width
    const contentHeight = contentEl.getBoundingClientRect().height


    if (currentWidth <= contentWidth+256*2) { // не хватает ширины чтобы центровать
        fakeControlsEl.style.width = `${currentWidth-contentWidth-256}px`;

    } else {
        fakeControlsEl.style.width = `256px`;
    }

    if (currentWidth <= contentWidth+256) { // не хватает ширины чтобы жить
        mainEl.style.flexDirection = 'column';
        fakeControlsEl.style.display = 'none';

        // if (currentHeight <= contentHeight+400) { // ещё и высоты не хватает
        //     // scalerEl.style.scale = currentHeight/(contentHeight+420);
        //     console.log(contentHeight + " + " + 400 + " > " + currentHeight);
        // } else {
        //     // scalerEl.style.scale = 1;
        // }

    } else {    // 
        mainEl.style.flexDirection = 'row';
        // scalerEl.style.scale = 1;
        fakeControlsEl.style.display = 'block';
    }


    
}

window.addEventListener("load", () => {
    adjustScale();
    window.addEventListener("resize", adjustScale);
});
