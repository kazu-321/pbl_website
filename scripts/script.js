// ==============================
// ROS
// ==============================

const ros = new ROSLIB.Ros({

    url: "ws://10.180.185.95:9090"
});

const connection_status =
    document.getElementById(
        "connection-status"
    );


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

    drawMap();

    drawPath();

    drawRobot();
    
    requestAnimationFrame(draw);
}

draw();