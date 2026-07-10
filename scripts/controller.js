console.log("controller.js auto/manual view version loaded");

// ==============================
// Controller
// ==============================

function initializeController(ros) {

    // 二重初期化防止
    if (window.__robotControllerInitialized) {
        return;
    }
    window.__robotControllerInitialized = true;

    // ==============================
    // Elements
    // ==============================

    const powerToggleBtn =
        document.getElementById("power-toggle-btn");

    const autoToggleBtn =
        document.getElementById("auto-toggle-btn");

    const sideCards =
        document.querySelector(".side-cards");

    const manualControlPanel =
        document.getElementById("manual-control-panel");

    const joystickZone =
        document.getElementById("joystick-zone");

    const joystickBase =
        document.getElementById("joystick-base");

    const joystickStick =
        document.getElementById("joystick-stick");

    const forwardValue =
        document.getElementById("manual-forward-value");

    const turnValue =
        document.getElementById("manual-turn-value");

    const forwardBar =
        document.getElementById("manual-forward-bar");

    const turnBar =
        document.getElementById("manual-turn-bar");

    const sheetEyebrow =
        document.getElementById("sheet-eyebrow");

    const selectedDestination =
        document.getElementById("selected-destination");

    const selectedTime =
        document.getElementById("selected-time");


    // ==============================
    // State
    // ==============================

    let powerIsRunning = true;
    let autoIsRunning = false;

    let manualForward = 0;
    let manualTurn = 0;

    let activePointerId = null;
    let publishTimer = null;
    let savedSummary = null;

    const DEAD_ZONE = 0.08;
    const PUBLISH_INTERVAL = 50;


    // ==============================
    // ROS Topics
    // ==============================

    let joyTopic = null;
    let powerStateTopic = null;
    let autoStateTopic = null;

    try {

        joyTopic = new ROSLIB.Topic({
            ros: ros,
            name: "/controller/joy",
            messageType: "sensor_msgs/Joy"
        });

        powerStateTopic = new ROSLIB.Topic({
            ros: ros,
            name: "/power",
            messageType: "std_msgs/Bool"
        });

        autoStateTopic = new ROSLIB.Topic({
            ros: ros,
            name: "/is_auto",
            messageType: "std_msgs/Bool"
        });

    } catch (error) {

        console.error(
            "ControllerのROS Topic作成に失敗しました",
            error
        );
    }


    // ==============================
    // Utility
    // ==============================

    function clamp(value, minimum, maximum) {
        return Math.min(
            maximum,
            Math.max(minimum, value)
        );
    }

    function applyDeadZone(value) {
        if (Math.abs(value) < DEAD_ZONE) {
            return 0;
        }
        return value;
    }

    function isRosConnected() {
        return Boolean(
            ros &&
            ros.isConnected &&
            joyTopic
        );
    }

    function createJoyMessage(axes, buttons) {
        return new ROSLIB.Message({
            header: {
                stamp: {
                    sec: 0,
                    nanosec: 0
                },
                frame_id: ""
            },
            axes: axes,
            buttons: buttons
        });
    }

    function publishJoy(axes, buttons) {
        if (!isRosConnected()) {
            return;
        }

        joyTopic.publish(
            createJoyMessage(
                axes,
                buttons
            )
        );
    }

    function publishJoyButton(buttonIndex) {
        const buttons = [0, 0, 0, 0];
        buttons[buttonIndex] = 1;

        publishJoy(
            [0, 0],
            buttons
        );
    }

    function publishManualAxes() {
        // auto運転中はジョイスティック送信しない
        if (autoIsRunning) {
            return;
        }

        /*
         * axes[0] = 左右旋回
         * axes[1] = 前後移動
         */
        publishJoy(
            [
                manualTurn,
                manualForward
            ],
            [0, 0, 0, 0]
        );
    }

    function publishManualStop() {
        manualForward = 0;
        manualTurn = 0;

        publishJoy(
            [0, 0],
            [0, 0, 0, 0]
        );
    }

    function closeSideMenu() {
        const sideMenu =
            document.getElementById("side-menu");

        const overlay =
            document.getElementById("menu-overlay");

        const menuButton =
            document.getElementById("menu-btn");

        sideMenu?.classList.remove("show");
        overlay?.classList.remove("show");

        menuButton?.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    // ==============================
    // Summary
    // ==============================

    function saveSummary() {
        if (savedSummary) {
            return;
        }

        savedSummary = {
            eyebrow:
                sheetEyebrow?.textContent ??
                "選択中の目的地",

            destination:
                selectedDestination?.textContent ??
                "--",

            time:
                selectedTime?.textContent ??
                "--"
        };
    }

    function showManualSummary() {
        saveSummary();

        if (sheetEyebrow) {
            sheetEyebrow.textContent = "操作モード";
        }

        if (selectedDestination) {
            selectedDestination.textContent = "手動操作";
        }

        if (selectedTime) {
            selectedTime.textContent = "ジョイスティック";
        }
    }

    function restoreSummary() {
        if (!savedSummary) {
            return;
        }

        if (sheetEyebrow) {
            sheetEyebrow.textContent = savedSummary.eyebrow;
        }

        if (selectedDestination) {
            selectedDestination.textContent = savedSummary.destination;
        }

        if (selectedTime) {
            selectedTime.textContent = savedSummary.time;
        }
    }


    // ==============================
    // View Control
    // ==============================

    function setRightPanelMode(mode) {
        const isManual = mode === "manual";

        document.body.classList.toggle(
            "manual-view",
            isManual
        );

        document.body.classList.toggle(
            "auto-view",
            !isManual
        );

        sideCards?.setAttribute(
            "aria-hidden",
            String(isManual)
        );

        manualControlPanel?.setAttribute(
            "aria-hidden",
            String(!isManual)
        );

        if (isManual) {
            showManualSummary();
            startPublishing();
        } else {
            restoreSummary();
            stopPublishing();
            resetJoystick(true);
        }
    }


    // ==============================
    // Buttons
    // ==============================

    function updatePowerButton() {
        if (!powerToggleBtn) {
            return;
        }

        powerToggleBtn.textContent =
            powerIsRunning
                ? "一時停止"
                : "再開";
    }

    function updateAutoButton() {
        if (!autoToggleBtn) {
            return;
        }

        autoToggleBtn.disabled = false;

        autoToggleBtn.textContent =
            autoIsRunning
                ? "自動運転を停止"
                : "▶ 自動運転を開始";
    }

    powerToggleBtn?.addEventListener(
        "click",
        () => {
            publishJoyButton(
                powerIsRunning ? 0 : 1
            );
        }
    );

    autoToggleBtn?.addEventListener(
        "click",
        () => {

            if (autoIsRunning) {
                // 自動運転停止
                publishJoyButton(2);
                autoIsRunning = false;
                updateAutoButton();
                setRightPanelMode("manual");
            } else {
                // 自動運転開始
                publishJoyButton(3);
                autoIsRunning = true;
                updateAutoButton();
                setRightPanelMode("auto");
            }

            closeSideMenu();
        }
    );


    // ==============================
    // Subscribe
    // ==============================

    try {

        powerStateTopic?.subscribe((message) => {
            powerIsRunning = Boolean(message.data);
            updatePowerButton();
        });

        autoStateTopic?.subscribe((message) => {
            autoIsRunning = Boolean(message.data);
            updateAutoButton();

            if (autoIsRunning) {
                setRightPanelMode("auto");
            } else {
                setRightPanelMode("manual");
            }
        });

    } catch (error) {

        console.error(
            "Controllerのsubscribeに失敗しました",
            error
        );
    }


    // ==============================
    // Manual Display
    // ==============================

    function updateAxisBar(element, value) {
        if (!element) {
            return;
        }

        const normalized =
            clamp(value, -1, 1);

        const amount =
            Math.abs(normalized) * 50;

        element.style.width =
            `${amount}%`;

        element.style.left =
            normalized >= 0
                ? "50%"
                : `${50 - amount}%`;
    }

    function updateManualDisplay() {
        if (forwardValue) {
            forwardValue.textContent =
                manualForward.toFixed(2);
        }

        if (turnValue) {
            turnValue.textContent =
                manualTurn.toFixed(2);
        }

        updateAxisBar(
            forwardBar,
            manualForward
        );

        updateAxisBar(
            turnBar,
            manualTurn
        );
    }


    // ==============================
    // Publish Timer
    // ==============================

    function startPublishing() {
        stopPublishing();

        publishTimer =
            window.setInterval(
                publishManualAxes,
                PUBLISH_INTERVAL
            );
    }

    function stopPublishing() {
        if (publishTimer === null) {
            return;
        }

        window.clearInterval(
            publishTimer
        );

        publishTimer = null;
    }


    // ==============================
    // Joystick Reset
    // ==============================

    function resetJoystick(sendStop = true) {
        manualForward = 0;
        manualTurn = 0;
        activePointerId = null;

        if (joystickStick) {
            joystickStick.style.transform =
                "translate(-50%, -50%)";
        }

        joystickZone?.classList.remove(
            "is-active"
        );

        updateManualDisplay();

        if (sendStop) {
            publishManualStop();
        }
    }


    // ==============================
    // Joystick Position
    // ==============================

    function updateJoystick(event) {

        if (
            !joystickBase ||
            !joystickStick
        ) {
            return;
        }

        const baseRect =
            joystickBase.getBoundingClientRect();

        const stickRect =
            joystickStick.getBoundingClientRect();

        const centerX =
            baseRect.left +
            baseRect.width / 2;

        const centerY =
            baseRect.top +
            baseRect.height / 2;

        const rawX =
            event.clientX - centerX;

        const rawY =
            event.clientY - centerY;

        const maximumRadius =
            Math.max(
                1,
                baseRect.width / 2 -
                stickRect.width / 2 -
                8
            );

        const distance =
            Math.hypot(rawX, rawY);

        const scale =
            distance > maximumRadius
                ? maximumRadius / distance
                : 1;

        const x =
            rawX * scale;

        const y =
            rawY * scale;

        manualTurn =
            applyDeadZone(
                clamp(
                    -x / maximumRadius,
                    -1,
                    1
                )
            );

        manualForward =
            applyDeadZone(
                clamp(
                    -y / maximumRadius,
                    -1,
                    1
                )
            );

        joystickStick.style.transform =
            `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        updateManualDisplay();
        publishManualAxes();
    }


    // ==============================
    // Joystick Events
    // ==============================

    joystickZone?.addEventListener(
        "pointerdown",
        (event) => {

            if (autoIsRunning) {
                return;
            }

            event.preventDefault();

            activePointerId = event.pointerId;

            joystickZone.setPointerCapture(
                event.pointerId
            );

            joystickZone.classList.add(
                "is-active"
            );

            updateJoystick(event);
        }
    );

    joystickZone?.addEventListener(
        "pointermove",
        (event) => {

            if (
                autoIsRunning ||
                activePointerId !== event.pointerId
            ) {
                return;
            }

            event.preventDefault();
            updateJoystick(event);
        }
    );

    function finishJoystick(event) {

        if (
            activePointerId !== null &&
            activePointerId !== event.pointerId
        ) {
            return;
        }

        if (
            joystickZone &&
            joystickZone.hasPointerCapture(
                event.pointerId
            )
        ) {
            joystickZone.releasePointerCapture(
                event.pointerId
            );
        }

        resetJoystick(true);
    }

    joystickZone?.addEventListener(
        "pointerup",
        finishJoystick
    );

    joystickZone?.addEventListener(
        "pointercancel",
        finishJoystick
    );

    joystickZone?.addEventListener(
        "lostpointercapture",
        () => {
            if (activePointerId !== null) {
                resetJoystick(true);
            }
        }
    );


    // ==============================
    // Safety Stop
    // ==============================

    window.addEventListener(
        "blur",
        () => {
            if (!autoIsRunning) {
                resetJoystick(true);
            }
        }
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                !autoIsRunning &&
                document.visibilityState !== "visible"
            ) {
                resetJoystick(true);
            }
        }
    );


    // ==============================
    // Initial UI
    // ==============================

    updatePowerButton();
    updateAutoButton();
    updateManualDisplay();

    // 初期状態は手動スティックを表示
    setRightPanelMode("manual");

    console.log("通常時ジョイスティック表示Controllerを初期化しました");
}