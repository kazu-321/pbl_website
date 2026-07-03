// ==============================
// Controller
// ==============================

function initializeController(ros) {
    const powerToggleBtn = document.getElementById("power-toggle-btn");
    const autoToggleBtn = document.getElementById("auto-toggle-btn");

    const joyTopic = new ROSLIB.Topic({
        ros,
        name: "/controller/joy",
        messageType: "sensor_msgs/Joy"
    });

    const powerStateTopic = new ROSLIB.Topic({
        ros,
        name: "/power",
        messageType: "std_msgs/Bool"
    });

    const autoStateTopic = new ROSLIB.Topic({
        ros,
        name: "/is_auto",
        messageType: "std_msgs/Bool"
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

    function setPowerState(value) {
        powerIsRunning = Boolean(value);
        updatePowerButton();
    }

    function setAutoState(value) {
        autoIsRunning = Boolean(value);
        updateAutoButton();
    }

    powerStateTopic.subscribe((msg) => {
        setPowerState(msg.data);
    });

    autoStateTopic.subscribe((msg) => {
        setAutoState(msg.data);
    });

    powerToggleBtn.addEventListener("click", () => {
        publishJoyButton(powerIsRunning ? 0 : 1);
    });

    autoToggleBtn.addEventListener("click", () => {
        publishJoyButton(autoIsRunning ? 2 : 3);
    });

    updatePowerButton();
    updateAutoButton();
}
