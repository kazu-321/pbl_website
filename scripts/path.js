console.log("path.js loaded");

let pathData = null;


// ==============================
// Path Subscriber
// ==============================

function subscribePath() {

    const pathTopic = new ROSLIB.Topic({

        ros: ros,

        name: "/plan",

        messageType: "nav_msgs/Path"
    });

    pathTopic.subscribe((msg) => {

        pathData = msg;

        console.log(
            "Path received:",
            msg.poses.length
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

    if (pathData.poses.length === 0) return;


    const resolution =
        occupancyGrid.info.resolution;

    const mapHeight =
        occupancyGrid.info.height;

    const originY =
        occupancyGrid.info.origin.position.y;

    const worldHeight =
        mapHeight * resolution;


    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 4;

    ctx.beginPath();

    for (let i = 0; i < pathData.poses.length; i++) {

        const pose =
            pathData.poses[i];

        const x =
            pose.pose.position.x;

        const y =
            pose.pose.position.y;


        const screenX =
            mapToScreenX(x);

        // 地図描画と同じY反転
        const correctedY =
            originY +
            worldHeight -
            (y - originY);

        const screenY =
            mapToScreenY(correctedY);

            
        if (i === 0) {

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


    // ==========================
    // Goal Marker
    // ==========================

    const goal =
        pathData.poses[
            pathData.poses.length - 1
        ];

    const goalX =
        goal.pose.position.x;

    const goalY =
        goal.pose.position.y;

    const correctedGoalY =
        originY +
        worldHeight -
        (goalY - originY);

    ctx.fillStyle = "red";

    ctx.beginPath();

    ctx.arc(
        mapToScreenX(goalX),
        mapToScreenY(correctedGoalY),
        8,
        0,
        Math.PI * 2
    );

    ctx.fill();
}