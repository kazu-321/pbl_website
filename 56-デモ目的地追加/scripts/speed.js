console.log("speed.js loaded");

// ==============================
// Robot Speed
// ==============================

// 実際の環境でトピック名が違う場合はここを変更
const ROBOT_SPEED_TOPIC_NAME = "/odometry";

// ROS 2のOdometry
const ROBOT_SPEED_MESSAGE_TYPE =
    "nav_msgs/msg/Odometry";

// 一定時間データが届かなければ取得失敗とする
const SPEED_TIMEOUT_MS = 2000;

let speedTopic = null;
let lastSpeedReceivedAt = 0;
let speedTimeoutTimer = null;


// ==============================
// Display
// ==============================

function getRobotSpeedElement() {
    return document.getElementById(
        "robot-speed"
    );
}


function showRobotSpeed(speedMps) {
    const speedElement =
        getRobotSpeedElement();

    if (!speedElement) {
        return;
    }

    speedElement.textContent =
        `${speedMps.toFixed(2)} m/s`;
}


function showRobotSpeedUnavailable() {
    const speedElement =
        getRobotSpeedElement();

    if (!speedElement) {
        return;
    }

    speedElement.textContent = "－";
}


// ==============================
// Validation
// ==============================

function getLinearSpeed(message) {
    const linear =
        message?.twist?.twist?.linear;

    if (!linear) {
        return null;
    }

    const x = Number(linear.x ?? 0);
    const y = Number(linear.y ?? 0);
    const z = Number(linear.z ?? 0);

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
    ) {
        return null;
    }

    /*
     * 前後方向だけでなく、
     * 横方向の移動も含めた速度を計算
     */
    return Math.hypot(x, y, z);
}


// ==============================
// Subscriber
// ==============================

function subscribeSpeed() {

    // 二重購読防止
    if (speedTopic) {
        return;
    }

    speedTopic =
        new ROSLIB.Topic({
            ros: ros,
            name:
                ROBOT_SPEED_TOPIC_NAME,
            messageType:
                ROBOT_SPEED_MESSAGE_TYPE
        });


    speedTopic.subscribe(message => {

        const speed =
            getLinearSpeed(message);

        if (speed === null) {
            console.error(
                "速度データが正しくありません",
                message
            );

            showRobotSpeedUnavailable();
            return;
        }

        lastSpeedReceivedAt =
            Date.now();

        showRobotSpeed(speed);
    });


    // データが止まっていないか監視
    if (speedTimeoutTimer === null) {

        speedTimeoutTimer =
            window.setInterval(
                () => {

                    if (
                        lastSpeedReceivedAt ===
                        0
                    ) {
                        showRobotSpeedUnavailable();
                        return;
                    }

                    const elapsed =
                        Date.now() -
                        lastSpeedReceivedAt;

                    if (
                        elapsed >
                        SPEED_TIMEOUT_MS
                    ) {
                        showRobotSpeedUnavailable();
                    }
                },
                500
            );
    }


    ros.on("close", () => {
        lastSpeedReceivedAt = 0;
        showRobotSpeedUnavailable();
    });


    ros.on("error", () => {
        lastSpeedReceivedAt = 0;
        showRobotSpeedUnavailable();
    });
}

// ページを開いた直後は速度未取得
showRobotSpeedUnavailable();