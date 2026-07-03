// ==============================
// Canvas
// ==============================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "black";
document.body.style.touchAction = "none";


// ==============================
// Camera
// ==============================

let cameraX = 0;
let cameraY = 0;

let zoom = 40;

let followRobot = false;


// ==============================
// Map Data
// ==============================

let occupancyGrid = null;

const MAP_SKIP = 4;

let mapCanvas =
    document.createElement("canvas");

let mapCtx =
    mapCanvas.getContext("2d");

let mapReady = false;


// ==============================
// Subscriber
// ==============================

function subscribeMap() {

    const mapTopic =
        new ROSLIB.Topic({

            ros: ros,

            name: "/map",

            messageType:
                "nav_msgs/OccupancyGrid"
        });

    mapTopic.subscribe((msg) => {

        occupancyGrid = msg;

        buildMapImage();
    });
}


// ==============================
// Build Map
// ==============================

function buildMapImage() {

    if (!occupancyGrid) return;

    const width =
        occupancyGrid.info.width;

    const height =
        occupancyGrid.info.height;

    const data =
        occupancyGrid.data;

    mapCanvas.width =
        Math.ceil(width / MAP_SKIP);

    mapCanvas.height =
        Math.ceil(height / MAP_SKIP);

    for (let y = 0; y < height; y += MAP_SKIP) {

        for (let x = 0; x < width; x += MAP_SKIP) {

            const index =
                y * width + x;

            const value =
                data[index];

            if (value === -1) {

                mapCtx.fillStyle = "#666";

            } else if (value === 0) {

                mapCtx.fillStyle = "#fff";

            } else {

                mapCtx.fillStyle = "#000";
            }

            mapCtx.fillRect(
            (width - 1 - x) / MAP_SKIP,
            y / MAP_SKIP,
            1,
            1
            );
        }
    }

    mapReady = true;
}


// ==============================
// Coordinate
// ==============================

function mapToScreenX(x) {

    return (
        (x - cameraX) * zoom +
        canvas.width / 2
    );
}

function mapToScreenY(y) {

    return (
        canvas.height / 2 -
        (y - cameraY) * zoom
    );
}


// ==============================
// Draw Map
// ==============================

function drawMap() {

    if (!mapReady) return;

    const resolution =
        occupancyGrid.info.resolution;

    const width =
        occupancyGrid.info.width;

    const height =
        occupancyGrid.info.height;

    const originX =
        occupancyGrid.info.origin.position.x;

    const originY =
        occupancyGrid.info.origin.position.y;

    const worldWidth =
        width * resolution;

    const worldHeight =
        height * resolution;

    const screenX =
        mapToScreenX(originX);

    const screenY =
        mapToScreenY(
            originY + worldHeight
        );

    ctx.drawImage(
        mapCanvas,
        screenX,
        screenY,
        worldWidth * zoom,
        worldHeight * zoom
    );
}


// ==============================
// Mouse Drag
// ==============================

let dragging = false;

let lastX = 0;
let lastY = 0;

canvas.addEventListener("mousedown", (e) => {

    dragging = true;

    lastX = e.clientX;
    lastY = e.clientY;
});

window.addEventListener("mouseup", () => {

    dragging = false;
});

window.addEventListener("mousemove", (e) => {

    if (!dragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    cameraX -= dx / zoom;
    cameraY += dy / zoom;

    lastX = e.clientX;
    lastY = e.clientY;
});


// ==============================
// Zoom
// ==============================

canvas.addEventListener("wheel", (e) => {

    e.preventDefault();

    if (e.deltaY > 0) {

        zoom *= 0.9;

    } else {

        zoom *= 1.1;
    }

    zoom = Math.max(
        2,
        Math.min(zoom, 200)
    );

}, { passive: false });


// ==============================
// Resize
// ==============================

window.addEventListener("resize", () => {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;
});