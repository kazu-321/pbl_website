// ==============================
// ROS
// ==============================

const ros = new ROSLIB.Ros({

    url: "ws://kazubuntu24.local:9090"
});

const connection_status =
    document.getElementById(
        "connection-status"
    );

initializeGoalPublisher(ros);
// ==============================
// Connection
// ==============================

ros.on("connection", () => {

    console.log("Connected");

    connection_status.textContent =
        "接続中";

    subscribeMap();

    subscribePath();

    subscribePose();

});

ros.on("close", () => {

    console.log("Disconnected");

    connection_status.textContent =
        "未接続";
});

ros.on("error", (error) => {

    console.error(error);

    connection_status.textContent =
        "接続エラー";
});

initializeController(ros);

// ==============================
// Draw Loop
// ==============================

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    updateCamera();

    drawMap();

    drawPath();

    drawRobot();
    
    requestAnimationFrame(draw);
}

draw();
