// ==============================
// Route Settings
// ==============================

/*
 * ロボットが停止中など、実測速度を使えないときに
 * 到着予想の計算へ使用する基準速度です。
 *
 * 実際の自動走行速度に合わせて変更してください。
 */
const NOMINAL_AUTO_SPEED_MPS = 0.8;

// この速度以上なら実測速度を到着予想に使う
const MIN_MEASURED_SPEED_MPS = 0.08;

// 誤測位による異常速度を除外する上限
const MAX_REASONABLE_SPEED_MPS = 3.0;

// ゴールからこの距離以内なら到着と判定
const ARRIVAL_THRESHOLD_METERS = 0.25;

// 別の目的地と判定するゴール位置の差
const GOAL_CHANGE_DISTANCE_METERS = 0.5;

// 画面表示の更新間隔
const ROUTE_INFO_UPDATE_INTERVAL_MS = 250;


// ==============================
// Route State
// ==============================

let pathData = null;

// 新しい目的地を設定した時点のルート全長
let initialRouteDistance = 0;

// 前回のゴール座標
let previousGoalPosition = null;

// 現在のルート情報
let currentPathMetrics = null;


// ==============================
// Speed State
// ==============================

let estimatedRobotSpeed = 0;
let previousSpeedSample = null;


// ==============================
// Route Information Elements
// ==============================

let routeInfoElements = null;


// ==============================
// Utility
// ==============================

function clampRouteValue(value, minimum, maximum) {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}


function distanceBetweenPoints(point1, point2) {
    return Math.hypot(
        point2.x - point1.x,
        point2.y - point1.y
    );
}


function getPathPosition(pathPose) {
    return {
        x: Number(pathPose.pose.position.x),
        y: Number(pathPose.pose.position.y)
    };
}


function getRobotPosition() {
    if (
        typeof robotPose === "undefined" ||
        !robotPose ||
        !robotPose.pose ||
        !robotPose.pose.position
    ) {
        return null;
    }

    const x = Number(
        robotPose.pose.position.x
    );

    const y = Number(
        robotPose.pose.position.y
    );

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {
        return null;
    }

    return {
        x,
        y
    };
}


// ==============================
// Find UI Elements
// ==============================

function findValueElementByLabel(labelText) {
    const labels = [
        ...document.querySelectorAll(
            ".side-cards .label"
        )
    ];

    const matchingLabel =
        labels.find(element => {
            return (
                element.textContent.trim() ===
                labelText
            );
        });

    if (!matchingLabel) {
        return null;
    }

    return matchingLabel
        .parentElement
        ?.querySelector(".value") ?? null;
}


function getRouteInfoElements() {
    if (routeInfoElements) {
        return routeInfoElements;
    }

    routeInfoElements = {
        estimatedTime:
            findValueElementByLabel(
                "到着予想"
            ),

        distance:
            findValueElementByLabel(
                "距離"
            ),

        progress:
            findValueElementByLabel(
                "進行状況"
            ),

        speed:
            findValueElementByLabel(
                "速度"
            ),

        mobileEstimatedTime:
            document.getElementById(
                "selected-time"
            ),

        mobileDistance:
            document.querySelector(
                ".sheet-summary-text > p:last-child span:last-child"
            )
    };

    return routeInfoElements;
}


// ==============================
// Format
// ==============================

function formatRemainingDistance(distanceMeters) {
    if (!Number.isFinite(distanceMeters)) {
        return "--";
    }

    if (distanceMeters < 0.05) {
        return "0m";
    }

    if (distanceMeters < 10) {
        return `${distanceMeters.toFixed(1)}m`;
    }

    return `${Math.round(distanceMeters)}m`;
}


function formatEstimatedTime(seconds) {
    if (!Number.isFinite(seconds)) {
        return "--";
    }

    const roundedSeconds =
        Math.max(
            0,
            Math.ceil(seconds)
        );

    if (roundedSeconds === 0) {
        return "到着";
    }

    if (roundedSeconds < 60) {
        return `${roundedSeconds}秒`;
    }

    const hours =
        Math.floor(
            roundedSeconds / 3600
        );

    const minutes =
        Math.floor(
            (
                roundedSeconds % 3600
            ) / 60
        );

    const remainingSeconds =
        roundedSeconds % 60;

    if (hours > 0) {
        if (minutes === 0) {
            return `${hours}時間`;
        }

        return `${hours}時間${minutes}分`;
    }

    if (remainingSeconds === 0) {
        return `${minutes}分`;
    }

    return `${minutes}分${remainingSeconds}秒`;
}


function formatSpeed(speedMps) {
    if (!Number.isFinite(speedMps)) {
        return "--";
    }

    return `${speedMps.toFixed(2)} m/s`;
}


// ==============================
// Build Path Metrics
// ==============================

function buildPathMetrics() {
    if (
        !pathData ||
        !Array.isArray(pathData.poses) ||
        pathData.poses.length === 0
    ) {
        currentPathMetrics = null;
        return null;
    }

    const positions =
        pathData.poses.map(
            getPathPosition
        );

    const cumulativeDistanceFromIndex =
        new Array(positions.length).fill(0);

    let totalDistance = 0;

    /*
     * 各地点からゴールまでの距離を、
     * 後ろから順番に計算します。
     */
    for (
        let index =
            positions.length - 2;

        index >= 0;

        index--
    ) {
        const segmentDistance =
            distanceBetweenPoints(
                positions[index],
                positions[index + 1]
            );

        totalDistance += segmentDistance;

        cumulativeDistanceFromIndex[index] =
            totalDistance;
    }

    const goalPosition =
        positions[
            positions.length - 1
        ];

    const goalChanged =
        !previousGoalPosition ||
        distanceBetweenPoints(
            previousGoalPosition,
            goalPosition
        ) >
        GOAL_CHANGE_DISTANCE_METERS;

    /*
     * 目的地が変わった場合は、
     * 進行状況計算用の全長をリセットします。
     */
    if (goalChanged) {
        initialRouteDistance =
            totalDistance;

        previousGoalPosition = {
            ...goalPosition
        };
    } else {
        /*
         * 経路再計算で少し長くなった場合にも
         * 進行率が負にならないようにします。
         */
        initialRouteDistance =
            Math.max(
                initialRouteDistance,
                totalDistance
            );
    }

    currentPathMetrics = {
        positions,
        totalDistance,
        cumulativeDistanceFromIndex,
        goalPosition
    };

    return currentPathMetrics;
}


// ==============================
// Remaining Route Distance
// ==============================

function calculateRemainingDistance(
    robotPosition
) {
    const metrics =
        currentPathMetrics;

    if (
        !metrics ||
        metrics.positions.length === 0
    ) {
        return null;
    }

    const positions =
        metrics.positions;

    // 経路が1点だけの場合
    if (positions.length === 1) {
        return distanceBetweenPoints(
            robotPosition,
            positions[0]
        );
    }

    let closestDistance =
        Number.POSITIVE_INFINITY;

    let remainingDistance =
        metrics.totalDistance;

    /*
     * ロボット位置を経路の各線分へ投影し、
     * 最も近い位置からゴールまでの距離を求めます。
     */
    for (
        let index = 0;
        index < positions.length - 1;
        index++
    ) {
        const start =
            positions[index];

        const end =
            positions[index + 1];

        const segmentX =
            end.x - start.x;

        const segmentY =
            end.y - start.y;

        const segmentLengthSquared =
            segmentX * segmentX +
            segmentY * segmentY;

        if (segmentLengthSquared <= 0) {
            continue;
        }

        const robotOffsetX =
            robotPosition.x -
            start.x;

        const robotOffsetY =
            robotPosition.y -
            start.y;

        const projectionRatio =
            clampRouteValue(
                (
                    robotOffsetX *
                        segmentX +
                    robotOffsetY *
                        segmentY
                ) /
                    segmentLengthSquared,
                0,
                1
            );

        const projectedPoint = {
            x:
                start.x +
                segmentX *
                    projectionRatio,

            y:
                start.y +
                segmentY *
                    projectionRatio
        };

        const distanceToPath =
            distanceBetweenPoints(
                robotPosition,
                projectedPoint
            );

        if (
            distanceToPath <
            closestDistance
        ) {
            closestDistance =
                distanceToPath;

            const projectedToSegmentEnd =
                distanceBetweenPoints(
                    projectedPoint,
                    end
                );

            const segmentEndToGoal =
                metrics
                    .cumulativeDistanceFromIndex[
                        index + 1
                    ];

            remainingDistance =
                projectedToSegmentEnd +
                segmentEndToGoal;
        }
    }

    return Math.max(
        0,
        remainingDistance
    );
}


// ==============================
// Estimate Robot Speed
// 現在地の変化から速度を計算
// ==============================

function updateEstimatedRobotSpeed() {
    const robotPosition =
        getRobotPosition();

    const now =
        performance.now();

    if (!robotPosition) {
        estimatedRobotSpeed = 0;
        previousSpeedSample = null;
        return;
    }

    if (!previousSpeedSample) {
        previousSpeedSample = {
            position: robotPosition,
            time: now
        };

        return;
    }

    const elapsedSeconds =
        (
            now -
            previousSpeedSample.time
        ) / 1000;

    if (
        elapsedSeconds < 0.08 ||
        elapsedSeconds > 2
    ) {
        previousSpeedSample = {
            position: robotPosition,
            time: now
        };

        return;
    }

    const movedDistance =
        distanceBetweenPoints(
            previousSpeedSample.position,
            robotPosition
        );

    const measuredSpeed =
        movedDistance /
        elapsedSeconds;

    /*
     * 瞬間的な自己位置の飛びを除外します。
     */
    if (
        Number.isFinite(measuredSpeed) &&
        measuredSpeed <=
            MAX_REASONABLE_SPEED_MPS
    ) {
        if (measuredSpeed < 0.02) {
            estimatedRobotSpeed *= 0.7;

            if (
                estimatedRobotSpeed <
                0.01
            ) {
                estimatedRobotSpeed = 0;
            }
        } else {
            /*
             * 表示が激しく変化しないように
             * 移動平均をかけます。
             */
            estimatedRobotSpeed =
                estimatedRobotSpeed *
                    0.7 +
                measuredSpeed *
                    0.3;
        }
    }

    previousSpeedSample = {
        position: robotPosition,
        time: now
    };
}


// ==============================
// Update Route Information
// ==============================

function updateRouteInformation() {
    const elements =
        getRouteInfoElements();

    updateEstimatedRobotSpeed();

    if (elements.speed) {
        elements.speed.textContent =
            formatSpeed(
                estimatedRobotSpeed
            );
    }

    if (
        !currentPathMetrics ||
        !pathData ||
        !Array.isArray(pathData.poses) ||
        pathData.poses.length === 0
    ) {
        if (elements.estimatedTime) {
            elements.estimatedTime.textContent =
                "--";
        }

        if (elements.distance) {
            elements.distance.textContent =
                "--";
        }

        if (elements.progress) {
            elements.progress.textContent =
                "--";
        }

        return;
    }

    const robotPosition =
        getRobotPosition();

    const remainingDistance =
        robotPosition
            ? calculateRemainingDistance(
                robotPosition
            )
            : currentPathMetrics
                .totalDistance;

    if (
        remainingDistance === null ||
        !Number.isFinite(
            remainingDistance
        )
    ) {
        return;
    }

    const hasArrived =
        remainingDistance <=
        ARRIVAL_THRESHOLD_METERS;

    let progress = 0;

    if (
        initialRouteDistance >
        ARRIVAL_THRESHOLD_METERS
    ) {
        progress =
            (
                1 -
                remainingDistance /
                    initialRouteDistance
            ) *
            100;
    }

    progress =
        clampRouteValue(
            progress,
            0,
            100
        );

    if (hasArrived) {
        progress = 100;
    }

    /*
     * 走行中は実測速度を使用し、
     * 停止中は基準速度で予想します。
     */
    const calculationSpeed =
        estimatedRobotSpeed >=
        MIN_MEASURED_SPEED_MPS
            ? estimatedRobotSpeed
            : NOMINAL_AUTO_SPEED_MPS;

    const estimatedSeconds =
        hasArrived
            ? 0
            : remainingDistance /
                calculationSpeed;

    const timeText =
        formatEstimatedTime(
            estimatedSeconds
        );

    const distanceText =
        formatRemainingDistance(
            remainingDistance
        );

    const progressText =
        `${Math.round(progress)}%`;

    if (elements.estimatedTime) {
        elements.estimatedTime.textContent =
            timeText;
    }

    if (elements.distance) {
        elements.distance.textContent =
            distanceText;
    }

    if (elements.progress) {
        elements.progress.textContent =
            progressText;
    }

    /*
     * スマホの閉じた状態の表示も更新します。
     * 手動操作画面中は「ジョイスティック」の表示を維持します。
     */
    const isManualView =
        document.body.classList.contains(
            "manual-view"
        );

    if (!isManualView) {
        if (
            elements.mobileEstimatedTime
        ) {
            elements
                .mobileEstimatedTime
                .textContent =
                timeText;
        }

        if (elements.mobileDistance) {
            elements
                .mobileDistance
                .textContent =
                `・${distanceText}`;
        }
    }
}


// ==============================
// Path Subscriber
// ==============================

function subscribePath() {
    const pathTopic =
        new ROSLIB.Topic({
            ros: ros,
            name: "/plan",
            messageType: "nav_msgs/Path"
        });

    pathTopic.subscribe(message => {
        pathData = message;

        buildPathMetrics();

        updateRouteInformation();

        console.log(
            "Path received:",
            message.poses?.length ?? 0,
            "Total distance:",
            currentPathMetrics
                ?.totalDistance
                ?.toFixed(2) ?? "--"
        );
    });
}


// ==============================
// Path Draw
// ==============================

function drawPath() {
    if (!pathData) return;
    if (!occupancyGrid) return;
    if (!pathData.poses) return;
    if (pathData.poses.length === 0) {
        return;
    }

    const resolution =
        occupancyGrid.info.resolution;

    const mapHeight =
        occupancyGrid.info.height;

    const originY =
        occupancyGrid.info.origin
            .position.y;

    const worldHeight =
        mapHeight * resolution;

    const originX =
        occupancyGrid.info.origin
            .position.x;

    const worldWidth =
        occupancyGrid.info.width *
        occupancyGrid.info.resolution;

    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 4;
    ctx.beginPath();

    for (
        let index = 0;
        index < pathData.poses.length;
        index++
    ) {
        const pose =
            pathData.poses[index];

        const x =
            pose.pose.position.x;

        const y =
            pose.pose.position.y;

        const correctedX =
            originX +
            worldWidth -
            (x - originX);

        const correctedY =
            originY +
            worldHeight -
            (y - originY);

        const screenX =
            mapToScreenX(
                correctedX
            );

        const screenY =
            mapToScreenY(
                correctedY
            );

        if (index === 0) {
            ctx.moveTo(
                screenX,
                screenY
            );
        } else {
            ctx.lineTo(
                screenX,
                screenY
            );
        }
    }

    ctx.stroke();


    // ==============================
    // Goal Marker
    // ==============================

    const goal =
        pathData.poses[
            pathData.poses.length - 1
        ];

    const goalX =
        goal.pose.position.x;

    const goalY =
        goal.pose.position.y;

    const correctedGoalX =
        originX +
        worldWidth -
        (goalX - originX);

    const correctedGoalY =
        originY +
        worldHeight -
        (goalY - originY);

    ctx.fillStyle = "red";
    ctx.beginPath();

    ctx.arc(
        mapToScreenX(
            correctedGoalX
        ),
        mapToScreenY(
            correctedGoalY
        ),
        8,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


// ==============================
// Route Information Timer
// ==============================

window.setInterval(
    updateRouteInformation,
    ROUTE_INFO_UPDATE_INTERVAL_MS
);

updateRouteInformation();
