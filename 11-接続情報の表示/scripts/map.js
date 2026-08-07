// ==============================
// Canvas
// ==============================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "black";
document.body.style.touchAction = "none";


// ==============================
// Camera
// ==============================

let cameraX = 0;
let cameraY = 0;

let zoom = 40;

let followRobot = true;


// ==============================
// ROS Data
// ==============================

let occupancyGrid = null;
let robotPose = null;
let pathData = null;


// ==============================
// Map Cache
// ==============================

const MAP_SKIP = 4;

let mapCanvas = document.createElement("canvas");
let mapCtx = mapCanvas.getContext("2d");

let mapReady = false;

let lastMapUpdate = 0;


// ==============================
// WebSocket
// ==============================

const socket =
  new WebSocket("ws://10.38.162.95:9090");


// ==============================
// ROS Connect
// ==============================

socket.onopen = () => {

  console.log("Connected to rosbridge");

  socket.send(JSON.stringify({
    op: "subscribe",
    topic: "/map",
    type: "nav_msgs/msg/OccupancyGrid"
  }));

  socket.send(JSON.stringify({
    op: "subscribe",
    topic: "/robot_pose",
    type: "geometry_msgs/msg/PoseStamped"
  }));

  socket.send(JSON.stringify({
    op: "subscribe",
    topic: "/path",
    type: "nav_msgs/msg/Path"
  }));
};

socket.onerror = (e) => {
  console.log("WebSocket Error", e);
};

socket.onclose = () => {
  console.log("WebSocket Closed");
};


// ==============================
// ROS Receive
// ==============================

socket.onmessage = (event) => {

  const ros = JSON.parse(event.data);

  // map
  if (ros.topic === "/map") {

    const now = Date.now();

    if (now - lastMapUpdate > 5000) {

      occupancyGrid = ros.msg;

      buildMapImage();

      lastMapUpdate = now;

      console.log("Map Updated");
    }
  }

  // robot
  else if (ros.topic === "/robot_pose") {

    robotPose = ros.msg;
  }

  // path
  else if (ros.topic === "/path") {

    pathData = ros.msg;
  }
};


// ==============================
// Build Map Image
// ==============================

function buildMapImage() {

  if (!occupancyGrid) return;

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

  for (let y = 0; y < height; y += MAP_SKIP) {

    for (let x = 0; x < width; x += MAP_SKIP) {

      const index =
        y * width + x;

      const value =
        data[index];

      if (value === -1) {

        mapCtx.fillStyle = "#666";

      } else if (value === 0) {

        mapCtx.fillStyle = "#ffffff";

      } else {

        mapCtx.fillStyle = "#000000";
      }

      mapCtx.fillRect(
        x / MAP_SKIP,
        y / MAP_SKIP,
        1,
        1
      );
    }
  }

  mapReady = true;
}


// ==============================
// 座標変換
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
// 地図描画（超軽量版）
// ==============================

function drawMap() {

  if (!mapReady) return;

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
      originY + worldHeight
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
// 経路描画
// ==============================

function drawPath() {

  if (!pathData) return;

  const poses = pathData.poses;

  if (!poses || poses.length === 0) return;

  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 3;

  ctx.beginPath();

  for (let i = 0; i < poses.length; i++) {

    const pose = poses[i];

    const x = pose.pose.position.x;
    const y = pose.pose.position.y;

    const screenX = mapToScreenX(x);
    const screenY = mapToScreenY(y);

    if (i === 0) {

      ctx.moveTo(screenX, screenY);

    } else {

      ctx.lineTo(screenX, screenY);
    }
  }

  ctx.stroke();
}


// ==============================
// ロボット描画
// ==============================

function drawRobot() {

  if (!robotPose) return;

  const x = robotPose.pose.position.x;
  const y = robotPose.pose.position.y;

  const screenX = mapToScreenX(x);
  const screenY = mapToScreenY(y);

  ctx.fillStyle = "#0080ff";

  ctx.beginPath();
  ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#80c0ff";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(screenX, screenY, 16, 0, Math.PI * 2);
  ctx.stroke();
}


// ==============================
// 現在地ボタン
// ==============================

function drawLocationButton() {

  const x = canvas.width - 80;
  const y = canvas.height - 80;

  ctx.fillStyle = "white";

  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "blue";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(x - 15, y);
  ctx.lineTo(x + 15, y);

  ctx.moveTo(x, y - 15);
  ctx.lineTo(x, y + 15);

  ctx.stroke();
}


// ==============================
// カメラ追従
// ==============================

function updateCamera() {

  if (!followRobot) return;
  if (!robotPose) return;

  cameraX = robotPose.pose.position.x;
  cameraY = robotPose.pose.position.y;
}


// ==============================
// メイン描画
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

  drawLocationButton();

  requestAnimationFrame(draw);
}

draw();


// ==============================
// ドラッグ移動
// ==============================

let dragging = false;

let lastX = 0;
let lastY = 0;

canvas.addEventListener("mousedown", (e) => {

  dragging = true;

  lastX = e.clientX;
  lastY = e.clientY;

  followRobot = false;
});

window.addEventListener("mouseup", () => {

  dragging = false;
});

window.addEventListener("mousemove", (e) => {

  if (!dragging) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;

  cameraX -= dx / zoom;
  cameraY += dy / zoom;

  lastX = e.clientX;
  lastY = e.clientY;
});


// ==============================
// タッチ移動
// ==============================

let touching = false;

canvas.addEventListener("touchstart", (e) => {

  if (e.touches.length !== 1) return;

  touching = true;

  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;

  followRobot = false;
});

canvas.addEventListener("touchend", () => {

  touching = false;
});

canvas.addEventListener("touchmove", (e) => {

  if (!touching) return;

  if (e.touches.length !== 1) return;

  const touch = e.touches[0];

  const dx = touch.clientX - lastX;
  const dy = touch.clientY - lastY;

  cameraX -= dx / zoom;
  cameraY += dy / zoom;

  lastX = touch.clientX;
  lastY = touch.clientY;
});


// ==============================
// マウスホイールズーム
// ==============================

canvas.addEventListener("wheel", (e) => {

  e.preventDefault();

  if (e.deltaY > 0) {

    zoom *= 0.9;

  } else {

    zoom *= 1.1;
  }

  zoom = Math.max(
    2,
    Math.min(zoom, 200)
  );

}, { passive: false });


// ==============================
// 現在地ボタン
// ==============================

canvas.addEventListener("click", (e) => {

  const buttonX = canvas.width - 80;
  const buttonY = canvas.height - 80;

  const dx = e.clientX - buttonX;
  const dy = e.clientY - buttonY;

  const distance =
    Math.sqrt(dx * dx + dy * dy);

  if (distance < 30) {

    followRobot = true;

    if (robotPose) {

      cameraX =
        robotPose.pose.position.x;

      cameraY =
        robotPose.pose.position.y;
    }
  }
});


// ==============================
// Goal送信
// ==============================

canvas.addEventListener("dblclick", (event) => {

  const mapX =
    (event.clientX - canvas.width / 2)
    / zoom + cameraX;

  const mapY =
    -(event.clientY - canvas.height / 2)
    / zoom + cameraY;

  socket.send(JSON.stringify({

    op: "publish",

    topic: "/goal_pose",

    msg: {

      header: {
        frame_id: "map"
      },

      pose: {

        position: {
          x: mapX,
          y: mapY,
          z: 0
        },

        orientation: {
          x: 0,
          y: 0,
          z: 0,
          w: 1
        }
      }
    }
  }));

  console.log("Goal Sent");
});


// ==============================
// リサイズ
// ==============================

window.addEventListener("resize", () => {

  canvas.width =
    window.innerWidth;

  canvas.height =
    window.innerHeight;
});