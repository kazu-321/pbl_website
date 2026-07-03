// ==============================
// Controller
// ==============================

const powerToggleBtn = document.getElementById("power-toggle-btn");
const autoToggleBtn = document.getElementById("auto-toggle-btn");

const joyTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/controller/joy",
    messageType: "sensor_msgs/Joy"
});

let powerIsRunning = true;
let autoIsRunning = false;

function publishJoyButton(buttonIndex) {
    const buttons = [0, 0, 0, 0];
    buttons[buttonIndex] = 1;

    joyTopic.publish(new ROSLIB.Message({
        header: {
            stamp: { sec: 0, nsec: 0 },
            frame_id: ""
        },
        axes: [],
        buttons
    }));
}

function updatePowerButton() {
    powerToggleBtn.textContent = powerIsRunning ? "一時停止" : "再開";
}

function updateAutoButton() {
    autoToggleBtn.textContent = autoIsRunning ? "自動運転を停止" : "▶ 自動運転を開始";
}

powerToggleBtn.addEventListener("click", () => {
    if (powerIsRunning) {
        publishJoyButton(0);
        powerIsRunning = false;
    } else {
        publishJoyButton(1);
        powerIsRunning = true;
    }

    updatePowerButton();
});

autoToggleBtn.addEventListener("click", () => {
    if (autoIsRunning) {
        publishJoyButton(2);
        autoIsRunning = false;
    } else {
        publishJoyButton(3);
        autoIsRunning = true;
    }

    updateAutoButton();
});

updatePowerButton();
updateAutoButton();
