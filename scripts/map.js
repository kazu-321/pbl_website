// ==============================
// Canvas
// ==============================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Canvasの表示領域に合わせて描画サイズを更新
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (canvas.width !== width) {
        canvas.width = width;
    }

    if (canvas.height !== height) {
        canvas.height = height;
    }
}

resizeCanvas();

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "black";

// マップ上だけブラウザ標準のスクロール・拡大操作を止める
canvas.style.touchAction = "none";


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
// Map Touch / Mouse Control
// ==============================

// PointerEventを使うことで、マウス・指・タッチペンを同じ処理で扱う
const activePointers = new Map();

let lastSinglePoint = null;
let lastPinchDistance = null;
let lastPinchCenter = null;


// ==============================
// Utility
// ==============================

function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function getDistance(point1, point2) {
    return Math.hypot(
        point2.x - point1.x,
        point2.y - point1.y
    );
}

function getCenter(point1, point2) {
    return {
        x: (point1.x + point2.x) / 2,
        y: (point1.y + point2.y) / 2
    };
}

function clampZoom(value) {
    return Math.max(
        2,
        Math.min(value, 200)
    );
}


// ==============================
// Pointer Down
// ==============================

canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    const point = getCanvasPoint(event);

    activePointers.set(
        event.pointerId,
        point
    );

    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");

    // 指・マウスが1つだけなら地図移動を開始
    if (activePointers.size === 1) {
        lastSinglePoint = point;
        lastPinchDistance = null;
        lastPinchCenter = null;
    }

    // 2本指になったらピンチ操作を開始
    if (activePointers.size === 2) {
        const points = [...activePointers.values()];

        lastPinchDistance = getDistance(
            points[0],
            points[1]
        );

        lastPinchCenter = getCenter(
            points[0],
            points[1]
        );

        lastSinglePoint = null;
    }
});


// ==============================
// Pointer Move
// ==============================

canvas.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) {
        return;
    }

    event.preventDefault();

    const point = getCanvasPoint(event);

    activePointers.set(
        event.pointerId,
        point
    );

    // ------------------------------
    // 1本指・マウスドラッグ：地図移動
    // ------------------------------

    if (activePointers.size === 1) {
        const currentPoint =
            [...activePointers.values()][0];

        if (lastSinglePoint) {
            const dx =
                currentPoint.x - lastSinglePoint.x;

            const dy =
                currentPoint.y - lastSinglePoint.y;

            cameraX -= dx / zoom;
            cameraY += dy / zoom;

            // 手動操作時はロボット追従を解除
            followRobot = false;
        }

        lastSinglePoint = currentPoint;
        return;
    }

    // ------------------------------
    // 2本指：拡大縮小＋地図移動
    // ------------------------------

    if (activePointers.size >= 2) {
        const points =
            [...activePointers.values()];

        const currentDistance =
            getDistance(points[0], points[1]);

        const currentCenter =
            getCenter(points[0], points[1]);

        if (
            lastPinchDistance &&
            lastPinchCenter
        ) {
            // 前回の2本指中央位置にある地図座標を求める
            const worldX =
                cameraX +
                (
                    lastPinchCenter.x -
                    canvas.width / 2
                ) / zoom;

            const worldY =
                cameraY +
                (
                    canvas.height / 2 -
                    lastPinchCenter.y
                ) / zoom;

            const scale =
                currentDistance /
                lastPinchDistance;

            const newZoom =
                clampZoom(zoom * scale);

            // 指の中央にある地点がずれないようにカメラ位置を更新
            cameraX =
                worldX -
                (
                    currentCenter.x -
                    canvas.width / 2
                ) / newZoom;

            cameraY =
                worldY -
                (
                    canvas.height / 2 -
                    currentCenter.y
                ) / newZoom;

            zoom = newZoom;
            followRobot = false;
        }

        lastPinchDistance = currentDistance;
        lastPinchCenter = currentCenter;
    }
});


// ==============================
// Pointer Up / Cancel
// ==============================

function finishPointer(event) {
    activePointers.delete(event.pointerId);

    if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
    }

    // 2本指から1本指になったら、その位置から移動操作を続ける
    if (activePointers.size === 1) {
        lastSinglePoint =
            [...activePointers.values()][0];

        lastPinchDistance = null;
        lastPinchCenter = null;
        return;
    }

    // 3本以上から2本になった場合にもピンチ状態を作り直す
    if (activePointers.size >= 2) {
        const points =
            [...activePointers.values()];

        lastPinchDistance =
            getDistance(points[0], points[1]);

        lastPinchCenter =
            getCenter(points[0], points[1]);

        return;
    }

    lastSinglePoint = null;
    lastPinchDistance = null;
    lastPinchCenter = null;

    canvas.classList.remove("is-dragging");
}

canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);


// ==============================
// Mouse Wheel Zoom
// ==============================

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    const point = getCanvasPoint(event);

    // マウスカーソル位置にある地図座標を求める
    const worldX =
        cameraX +
        (
            point.x -
            canvas.width / 2
        ) / zoom;

    const worldY =
        cameraY +
        (
            canvas.height / 2 -
            point.y
        ) / zoom;

    const scale =
        event.deltaY > 0 ? 0.9 : 1.1;

    const newZoom =
        clampZoom(zoom * scale);

    // カーソル位置を中心に拡大・縮小する
    cameraX =
        worldX -
        (
            point.x -
            canvas.width / 2
        ) / newZoom;

    cameraY =
        worldY -
        (
            canvas.height / 2 -
            point.y
        ) / newZoom;

    zoom = newZoom;
    followRobot = false;

}, {
    passive: false
});


// ==============================
// Resize
// ==============================

window.addEventListener("resize", resizeCanvas);

window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 200);
});

// PCレイアウトの幅変更など、Canvas自体のサイズ変更にも対応
if (typeof ResizeObserver !== "undefined") {
    const canvasResizeObserver =
        new ResizeObserver(resizeCanvas);

    canvasResizeObserver.observe(canvas);
}