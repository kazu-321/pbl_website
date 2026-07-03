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

    const x = robotPose.pose.position.x;
    const y = robotPose.pose.position.y;

    // Map表示用にY反転
    const correctedY =
        originY +
        worldHeight -
        (y - originY);

    const screenX = mapToScreenX(x);
    const screenY = mapToScreenY(correctedY);

    // 自己位置
    // ==============================
    // ロボット（四角＋矢印）
    // ==============================

    // ロボットの向き（Quaternion → Yaw）
    const q = robotPose.pose.orientation;

    const yaw = Math.atan2(
        2 * (q.w * q.z + q.x * q.y),
        1 - 2 * (q.y * q.y + q.z * q.z)
    );

    // 描画位置へ移動
    ctx.save();

    ctx.translate(
        screenX,
        screenY
    );

    // 向きを反映
    ctx.rotate(-yaw + Math.PI / 2);

    // ------------------------------
    // 四角
    // ------------------------------

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

    // ------------------------------
    // 矢印
    // ------------------------------

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