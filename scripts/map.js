// ==============================
// Canvas
// ==============================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    const width = Math.max(
        1,
        Math.round(rect.width)
    );

    const height = Math.max(
        1,
        Math.round(rect.height)
    );

    if (canvas.width !== width) {
        canvas.width = width;
    }

    if (canvas.height !== height) {
        canvas.height = height;
    }
}

resizeCanvas();

// マップ上でブラウザ標準のスクロール操作を無効化
canvas.style.touchAction = "none";


// ==============================
// Camera
// ==============================

let cameraX = 0;
let cameraY = 0;

let zoom = 40;

let followRobot = false;

// 最初に地図を中央表示したか
let mapViewInitialized = false;

// ユーザーが手動でマップを動かしたか
let userAdjustedView = false;

// 地図の周囲に残す余白
const MAP_VIEW_PADDING = 25;

// ズーム範囲
const MIN_ZOOM = 2;
const MAX_ZOOM = 200;


// ==============================
// Map Data
// ==============================

let occupancyGrid = null;

const MAP_SKIP = 4;

const mapCanvas =
    document.createElement("canvas");

const mapCtx =
    mapCanvas.getContext("2d");

let mapReady = false;


// ==============================
// Map Subscriber
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
// Build Map Image
// ==============================

function buildMapImage() {

    if (!occupancyGrid) {
        return;
    }

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

    // Canvasサイズ変更時に内容は消えるが、
    // 明示的にもクリアする
    mapCtx.clearRect(
        0,
        0,
        mapCanvas.width,
        mapCanvas.height
    );

    for (
        let y = 0;
        y < height;
        y += MAP_SKIP
    ) {

        for (
            let x = 0;
            x < width;
            x += MAP_SKIP
        ) {

            const index =
                y * width + x;

            const value =
                data[index];

            if (value === -1) {

                // 未確認領域
                mapCtx.fillStyle = "#666";

            } else if (value === 0) {

                // 通行可能領域
                mapCtx.fillStyle = "#fff";

            } else {

                // 障害物
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

    /*
     * 最初の地図受信時だけ、
     * 地図全体が中央に収まるようにする
     */
    if (!mapViewInitialized) {

        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                fitMapToScreen();
            });
        });
    }
}


// ==============================
// Coordinate Conversion
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
// Fit Map To Screen
// 地図全体を適切な大きさで中央表示
// ==============================

function fitMapToScreen() {

    if (!occupancyGrid) {
        return;
    }

    resizeCanvas();

    const resolution =
        occupancyGrid.info.resolution;

    const mapWidth =
        occupancyGrid.info.width;

    const mapHeight =
        occupancyGrid.info.height;

    const originX =
        occupancyGrid.info.origin.position.x;

    const originY =
        occupancyGrid.info.origin.position.y;

    // 地図の実際の幅と高さ（m）
    const worldWidth =
        mapWidth * resolution;

    const worldHeight =
        mapHeight * resolution;

    if (
        worldWidth <= 0 ||
        worldHeight <= 0
    ) {
        return;
    }

    // Canvas内で地図に使用できる範囲
    const availableWidth =
        Math.max(
            1,
            canvas.width -
            MAP_VIEW_PADDING * 2
        );

    const availableHeight =
        Math.max(
            1,
            canvas.height -
            MAP_VIEW_PADDING * 2
        );

    const horizontalZoom =
        availableWidth / worldWidth;

    const verticalZoom =
        availableHeight / worldHeight;

    // 横と縦の両方に収まる倍率を採用
    zoom = Math.min(
        horizontalZoom,
        verticalZoom
    );

    zoom = clampZoom(zoom);

    // 地図の中心を画面中央へ合わせる
    cameraX =
        originX +
        worldWidth / 2;

    cameraY =
        originY +
        worldHeight / 2;

    mapViewInitialized = true;
    userAdjustedView = false;

    console.log(
        "地図を中央表示しました",
        {
            cameraX,
            cameraY,
            zoom,
            worldWidth,
            worldHeight
        }
    );
}


// ==============================
// Draw Map
// ==============================

function drawMap() {

    if (
        !mapReady ||
        !occupancyGrid
    ) {
        return;
    }

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
            originY +
            worldHeight
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

// PointerEventでマウス・指・タッチペンに対応
const activePointers = new Map();

let lastSinglePoint = null;
let lastPinchDistance = null;
let lastPinchCenter = null;


// ==============================
// Control Utility
// ==============================

function getCanvasPoint(event) {

    const rect =
        canvas.getBoundingClientRect();

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
        x:
            (point1.x + point2.x) / 2,

        y:
            (point1.y + point2.y) / 2
    };
}

function clampZoom(value) {

    return Math.max(
        MIN_ZOOM,
        Math.min(value, MAX_ZOOM)
    );
}


// ==============================
// Pointer Down
// ==============================

canvas.addEventListener(
    "pointerdown",
    (event) => {

        event.preventDefault();

        const point =
            getCanvasPoint(event);

        activePointers.set(
            event.pointerId,
            point
        );

        canvas.setPointerCapture(
            event.pointerId
        );

        canvas.classList.add(
            "is-dragging"
        );

        // 指またはマウスが1つ
        if (activePointers.size === 1) {

            lastSinglePoint = point;

            lastPinchDistance = null;
            lastPinchCenter = null;
        }

        // 2本指になった場合
        if (activePointers.size === 2) {

            const points =
                [...activePointers.values()];

            lastPinchDistance =
                getDistance(
                    points[0],
                    points[1]
                );

            lastPinchCenter =
                getCenter(
                    points[0],
                    points[1]
                );

            lastSinglePoint = null;
        }
    }
);


// ==============================
// Pointer Move
// ==============================

canvas.addEventListener(
    "pointermove",
    (event) => {

        if (
            !activePointers.has(
                event.pointerId
            )
        ) {
            return;
        }

        event.preventDefault();

        const point =
            getCanvasPoint(event);

        activePointers.set(
            event.pointerId,
            point
        );

        // --------------------------
        // 指1本・マウス：地図移動
        // --------------------------

        if (activePointers.size === 1) {

            const currentPoint =
                [...activePointers.values()][0];

            if (lastSinglePoint) {

                const dx =
                    currentPoint.x -
                    lastSinglePoint.x;

                const dy =
                    currentPoint.y -
                    lastSinglePoint.y;

                cameraX -= dx / zoom;
                cameraY += dy / zoom;

                userAdjustedView = true;
                followRobot = false;
            }

            lastSinglePoint =
                currentPoint;

            return;
        }

        // --------------------------
        // 指2本：拡大縮小＋移動
        // --------------------------

        if (activePointers.size >= 2) {

            const points =
                [...activePointers.values()];

            const currentDistance =
                getDistance(
                    points[0],
                    points[1]
                );

            const currentCenter =
                getCenter(
                    points[0],
                    points[1]
                );

            if (
                lastPinchDistance &&
                lastPinchCenter
            ) {

                /*
                 * 前回の2本指中央地点にある
                 * 地図座標を取得
                 */
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
                    clampZoom(
                        zoom * scale
                    );

                /*
                 * 指の中央にある地点が
                 * ずれないように調整
                 */
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

                userAdjustedView = true;
                followRobot = false;
            }

            lastPinchDistance =
                currentDistance;

            lastPinchCenter =
                currentCenter;
        }
    }
);


// ==============================
// Pointer Up / Cancel
// ==============================

function finishPointer(event) {

    activePointers.delete(
        event.pointerId
    );

    if (
        canvas.hasPointerCapture(
            event.pointerId
        )
    ) {

        canvas.releasePointerCapture(
            event.pointerId
        );
    }

    // 2本指から1本指になった場合
    if (activePointers.size === 1) {

        lastSinglePoint =
            [...activePointers.values()][0];

        lastPinchDistance = null;
        lastPinchCenter = null;

        return;
    }

    // 3本以上から2本になった場合
    if (activePointers.size >= 2) {

        const points =
            [...activePointers.values()];

        lastPinchDistance =
            getDistance(
                points[0],
                points[1]
            );

        lastPinchCenter =
            getCenter(
                points[0],
                points[1]
            );

        return;
    }

    // すべて離れた場合
    lastSinglePoint = null;
    lastPinchDistance = null;
    lastPinchCenter = null;

    canvas.classList.remove(
        "is-dragging"
    );
}

canvas.addEventListener(
    "pointerup",
    finishPointer
);

canvas.addEventListener(
    "pointercancel",
    finishPointer
);


// ==============================
// Mouse Wheel Zoom
// ==============================

canvas.addEventListener(
    "wheel",
    (event) => {

        event.preventDefault();

        const point =
            getCanvasPoint(event);

        // カーソル位置にある地図座標
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
            event.deltaY > 0
                ? 0.9
                : 1.1;

        const newZoom =
            clampZoom(
                zoom * scale
            );

        // カーソル位置を中心にズーム
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

        userAdjustedView = true;
        followRobot = false;
    },
    {
        passive: false
    }
);


// ==============================
// Current Location / Reset Button
// ==============================

const mapLocationButton =
    document.querySelector(
        ".map-location-btn"
    );

mapLocationButton?.addEventListener(
    "click",
    () => {

        /*
         * 現在地ボタンを押したとき、
         * 地図全体を中央へ戻す
         */
        fitMapToScreen();
    }
);


// ==============================
// Resize
// ==============================

function handleCanvasResize() {

    resizeCanvas();

    /*
     * ユーザーがまだ地図を動かしていない場合は、
     * サイズ変更後も中央表示を維持する
     */
    if (
        occupancyGrid &&
        !userAdjustedView
    ) {

        requestAnimationFrame(() => {

            fitMapToScreen();
        });
    }
}

window.addEventListener(
    "resize",
    handleCanvasResize
);

window.addEventListener(
    "orientationchange",
    () => {

        setTimeout(
            handleCanvasResize,
            200
        );
    }
);

// レイアウト変更にも対応
if (
    typeof ResizeObserver !==
    "undefined"
) {

    const canvasResizeObserver =
        new ResizeObserver(() => {

            handleCanvasResize();
        });

    canvasResizeObserver.observe(
        canvas
    );
}