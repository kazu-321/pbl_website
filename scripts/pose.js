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
    ctx.beginPath();
    ctx.arc(
        screenX,
        screenY,
        10,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = "#0066ff";
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "white";
    ctx.stroke();
}