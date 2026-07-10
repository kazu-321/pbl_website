console.log("pose.js loaded");

let robotPose = null;

// ==============================
// Pose Subscriber
// ==============================

function subscribePose() {

    const poseTopic = new ROSLIB.Topic({

        ros: ros,

        name: "/localization/current_pose",

        messageType: "geometry_msgs/PoseStamped"
    });

    poseTopic.subscribe((msg) => {

        robotPose = msg;

        // 必要なら確認用
        // console.log(robotPose.pose.position);

    });
}


// ==============================
// Robot Draw
// ==============================

function drawRobot() {

    if (!robotPose) return;
    if (!occupancyGrid) return;

    const resolution = occupancyGrid.info.resolution;
    const mapHeight = occupancyGrid.info.height;
    const originY = occupancyGrid.info.origin.position.y;
    const worldHeight = mapHeight * resolution;

    const originX = occupancyGrid.info.origin.position.x;
    const worldWidth = occupancyGrid.info.width * resolution;

    const x = robotPose.pose.position.x;
    const y = robotPose.pose.position.y;

    // Map表示用に補正
    const correctedX =
        originX +
        worldWidth -
        (x - originX);

    const correctedY =
        originY +
        worldHeight -
        (y - originY);

    const screenX = mapToScreenX(correctedX);
    const screenY = mapToScreenY(correctedY);

    // Quaternion → Yaw
    const q = robotPose.pose.orientation;

    const yaw = Math.atan2(
        2 * (q.w * q.z + q.x * q.y),
        1 - 2 * (q.y * q.y + q.z * q.z)
    );

    // ==============================
    // アイコンサイズ
    // 地図セル5個分
    // ==============================

    const robotSize = zoom * 0.5;
    const arrowSize = robotSize * 0.35;

    ctx.save();

    ctx.translate(
        screenX,
        screenY
    );

    ctx.rotate(-yaw + Math.PI / 2);

    // ------------------------------
    // 四角
    // ------------------------------

    ctx.fillStyle = "#0066ff";

    ctx.fillRect(
        -robotSize / 2,
        -robotSize / 2,
        robotSize,
        robotSize
    );

    ctx.lineWidth = 2;
    ctx.strokeStyle = "white";

    ctx.strokeRect(
        -robotSize / 2,
        -robotSize / 2,
        robotSize,
        robotSize
    );

    // ------------------------------
    // 矢印
    // ------------------------------

    ctx.beginPath();

    ctx.moveTo(0, -arrowSize);

    ctx.lineTo(0, arrowSize);

    ctx.lineTo(
        arrowSize * 0.6,
        arrowSize * 0.4
    );

    ctx.moveTo(0, arrowSize);

    ctx.lineTo(
        -arrowSize * 0.6,
        arrowSize * 0.4
    );

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.restore();
}