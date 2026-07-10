console.log("pose.js loaded");

// ==============================
// Pose State
// ==============================

let robotPose = null;

// 最後に正常な自己位置を受信した時刻
let robotPoseLastReceivedAt = 0;

// 2.5秒以上自己位置が届かなければ未取得とみなす
const ROBOT_POSE_TIMEOUT_MS = 2500;

let previousPoseAvailability = null;
let poseStatusTimer = null;
let poseTopic = null;
let rosStatusListenersInstalled = false;


// ==============================
// Pose Validation
// ==============================

function isValidRobotPose(message) {
    if (
        !message ||
        !message.pose ||
        !message.pose.position ||
        !message.pose.orientation
    ) {
        return false;
    }

    const position = message.pose.position;
    const orientation = message.pose.orientation;

    return (
        Number.isFinite(Number(position.x)) &&
        Number.isFinite(Number(position.y)) &&
        Number.isFinite(Number(position.z ?? 0)) &&
        Number.isFinite(Number(orientation.x)) &&
        Number.isFinite(Number(orientation.y)) &&
        Number.isFinite(Number(orientation.z)) &&
        Number.isFinite(Number(orientation.w))
    );
}


// ==============================
// ROS Connection Check
// ==============================

function isPoseRosConnected() {
    try {
        return (
            typeof ros !== "undefined" &&
            Boolean(ros?.isConnected)
        );
    } catch (error) {
        return false;
    }
}


// ==============================
// Pose Availability
// ==============================

function isRobotPoseAvailable() {
    const poseIsFresh =
        robotPoseLastReceivedAt > 0 &&
        Date.now() - robotPoseLastReceivedAt <=
            ROBOT_POSE_TIMEOUT_MS;

    return Boolean(
        isPoseRosConnected() &&
        robotPose &&
        poseIsFresh
    );
}

/*
 * goal.jsやpath.jsからも使用できるようにする
 */
window.isRobotPoseAvailable =
    isRobotPoseAvailable;


// ==============================
// Notify Pose Status
// ==============================

function notifyRobotPoseStatus(force = false) {
    const available =
        isRobotPoseAvailable();

    /*
     * 状態が変わっていない場合は、
     * 同じイベントを繰り返し送らない
     */
    if (
        !force &&
        previousPoseAvailability === available
    ) {
        return;
    }

    previousPoseAvailability =
        available;

    window.dispatchEvent(
        new CustomEvent(
            "robot-pose-status",
            {
                detail: {
                    available,
                    lastReceivedAt:
                        robotPoseLastReceivedAt
                }
            }
        )
    );

    console.log(
        available
            ? "自己位置を取得しました"
            : "自己位置を取得できません"
    );
}


// ==============================
// Clear Pose
// ==============================

function clearRobotPose() {
    robotPose = null;
    robotPoseLastReceivedAt = 0;

    notifyRobotPoseStatus(true);
}


// ==============================
// Pose Subscriber
// ==============================

function subscribePose() {

    /*
     * 再接続時に同じ購読を
     * 複数作成しないようにする
     */
    if (!poseTopic) {
        poseTopic =
            new ROSLIB.Topic({
                ros: ros,
                name:
                    "/localization/current_pose",
                messageType:
                    "geometry_msgs/PoseStamped"
            });

        poseTopic.subscribe(message => {
            if (!isValidRobotPose(message)) {
                console.error(
                    "不正な自己位置データを受信しました",
                    message
                );

                clearRobotPose();
                return;
            }

            robotPose = message;

            robotPoseLastReceivedAt =
                Date.now();

            notifyRobotPoseStatus();
        });
    }


    /*
     * ROS接続が切れた場合は
     * 自己位置不明にする
     */
    if (!rosStatusListenersInstalled) {
        rosStatusListenersInstalled = true;

        ros.on("close", () => {
            clearRobotPose();
        });

        ros.on("error", error => {
            console.error(
                "自己位置用ROS接続エラー",
                error
            );

            clearRobotPose();
        });
    }


    /*
     * 自己位置の受信が途中で止まっていないか、
     * 500msごとに確認する
     */
    if (poseStatusTimer === null) {
        poseStatusTimer =
            window.setInterval(
                () => {
                    notifyRobotPoseStatus();
                },
                500
            );
    }

    notifyRobotPoseStatus(true);
}


// ==============================
// Robot Draw
// ==============================

function drawRobot() {
    if (!isRobotPoseAvailable()) {
        return;
    }

    if (!occupancyGrid) {
        return;
    }

    const resolution =
        occupancyGrid.info.resolution;

    const mapHeight =
        occupancyGrid.info.height;

    const originY =
        occupancyGrid.info.origin.position.y;

    const worldHeight =
        mapHeight * resolution;

    const x =
        Number(
            robotPose.pose.position.x
        );

    const y =
        Number(
            robotPose.pose.position.y
        );

    // Map表示用にY反転
    const correctedY =
        originY +
        worldHeight -
        (y - originY);

    const originX =
        occupancyGrid.info.origin.position.x;

    const worldWidth =
        occupancyGrid.info.width *
        occupancyGrid.info.resolution;

    const correctedX =
        originX +
        worldWidth -
        (x - originX);

    const screenX =
        mapToScreenX(correctedX);

    const screenY =
        mapToScreenY(correctedY);


    // ==============================
    // Quaternion → Yaw
    // ==============================

    const q =
        robotPose.pose.orientation;

    const yaw =
        Math.atan2(
            2 * (
                q.w * q.z +
                q.x * q.y
            ),
            1 - 2 * (
                q.y * q.y +
                q.z * q.z
            )
        );


    // ==============================
    // Robot Draw
    // ==============================

    ctx.save();

    ctx.translate(
        screenX,
        screenY
    );

    ctx.rotate(
        -yaw +
        Math.PI / 2
    );


    // ロボット本体
    ctx.fillStyle = "#0066ff";

    ctx.fillRect(
        -10,
        -10,
        20,
        20
    );

    ctx.lineWidth = 2;
    ctx.strokeStyle = "white";

    ctx.strokeRect(
        -10,
        -10,
        20,
        20
    );


    // 向きの矢印
    ctx.beginPath();

    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.lineTo(6, 2);

    ctx.moveTo(0, 6);
    ctx.lineTo(-6, 2);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
}