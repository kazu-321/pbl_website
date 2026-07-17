console.log("controller.js auto/manual view + circle hit area loaded");

// ==============================
// Controller
// ==============================

function initializeController(ros) {

    // 二重初期化を防ぐ
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
    let currentPanelMode = null;

    // 中央付近の小さな入力を0として扱う
    const DEAD_ZONE = 0.08;

    // 手動操作値の送信周期（30ms = 33.3Hz）
    const PUBLISH_INTERVAL = 30;

    // /controller/joy のボタン番号
    const POWER_STOP_BUTTON = 0;
    const POWER_RESUME_BUTTON = 1;
    const AUTO_STOP_BUTTON = 2;
    const AUTO_START_BUTTON = 3;


    // ==============================
    // ROS Topics
    // ==============================

    const joyTopic = new ROSLIB.Topic({
        ros: ros,
        name: "/controller/joy",
        messageType: "sensor_msgs/Joy"
    });

    const powerStateTopic = new ROSLIB.Topic({
        ros: ros,
        name: "/power",
        messageType: "std_msgs/Bool"
    });

    const autoStateTopic = new ROSLIB.Topic({
        ros: ros,
        name: "/is_auto",
        messageType: "std_msgs/Bool"
    });


    // ==============================
    // ROS Publish
    // ==============================

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
        // 自動運転中はジョイスティック値を送らない
        if (autoIsRunning) {
            return;
        }

        /*
         * axes[0] = 旋回
         *   左旋回：正
         *   右旋回：負
         *
         * axes[1] = 前後
         *   前進：正
         *   後退：負
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
    // Power / Auto Buttons
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

        // ジョイスティックを触っている間は自動運転を開始させない
        autoToggleBtn.disabled =
            !autoIsRunning &&
            activePointerId !== null;

        autoToggleBtn.textContent =
            autoIsRunning
                ? "自動運転を停止"
                : "▶ 自動運転を開始";
    }

    function setPowerState(value) {
        powerIsRunning = Boolean(value);
        updatePowerButton();
    }

    function setAutoState(value) {
        autoIsRunning = Boolean(value);
        updateAutoButton();

        setRightPanelMode(
            autoIsRunning
                ? "auto"
                : "manual"
        );
    }

    powerToggleBtn?.addEventListener(
        "click",
        () => {
            publishJoyButton(
                powerIsRunning
                    ? POWER_STOP_BUTTON
                    : POWER_RESUME_BUTTON
            );
        }
    );

    autoToggleBtn?.addEventListener(
        "click",
        () => {
            // ジョイスティック操作中は開始しない
            if (
                !autoIsRunning &&
                activePointerId !== null
            ) {
                return;
            }

            if (autoIsRunning) {
                publishJoyButton(AUTO_STOP_BUTTON);

                // ROSから状態が返る前でも画面を切り替える
                setAutoState(false);
            } else {
                resetJoystick(true);
                publishJoyButton(AUTO_START_BUTTON);

                // ROSから状態が返る前でも画面を切り替える
                setAutoState(true);
            }

            closeSideMenu();
        }
    );


    // ==============================
    // Subscribe
    // ==============================

    powerStateTopic.subscribe((message) => {
        setPowerState(message.data);
    });

    autoStateTopic.subscribe((message) => {
        setAutoState(message.data);
    });


    // ==============================
    // Mobile Summary
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
            sheetEyebrow.textContent =
                "操作モード";
        }

        if (selectedDestination) {
            selectedDestination.textContent =
                "手動操作";
        }

        if (selectedTime) {
            selectedTime.textContent =
                "ジョイスティック";
        }
    }

    function restoreSummary() {
        if (!savedSummary) {
            return;
        }

        if (sheetEyebrow) {
            sheetEyebrow.textContent =
                savedSummary.eyebrow;
        }

        if (selectedDestination) {
            selectedDestination.textContent =
                savedSummary.destination;
        }

        if (selectedTime) {
            selectedTime.textContent =
                savedSummary.time;
        }
    }


    // ==============================
    // Publish Timer
    // ==============================

    function startPublishing() {
        stopPublishing();

        publishTimer = window.setInterval(
            publishManualAxes,
            PUBLISH_INTERVAL
        );
    }

    function stopPublishing() {
        if (publishTimer === null) {
            return;
        }

        window.clearInterval(publishTimer);
        publishTimer = null;
    }


    // ==============================
    // Right Panel Mode
    // ==============================

    function setRightPanelMode(mode) {
        const isManual = mode === "manual";

        // 同じモードならジョイスティック操作を中断しない
        if (currentPanelMode === mode) {
            return;
        }

        currentPanelMode = mode;

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
            resetJoystick(false);
            startPublishing();
        } else {
            stopPublishing();
            resetJoystick(true);
            restoreSummary();
        }
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
        updateAutoButton();

        if (sendStop) {
            publishManualStop();
        }
    }


    // ==============================
    // Joystick Hit Test
    // 外側の円の中だけ操作開始を許可する
    // ==============================

    function isInsideJoystickCircle(event) {
        if (!joystickBase) {
            return false;
        }

        const rect =
            joystickBase.getBoundingClientRect();

        const centerX =
            rect.left + rect.width / 2;

        const centerY =
            rect.top + rect.height / 2;

        const radius =
            Math.min(
                rect.width,
                rect.height
            ) / 2;

        const distance =
            Math.hypot(
                event.clientX - centerX,
                event.clientY - centerY
            );

        return distance <= radius;
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

        /*
         * スティックの中心が外円を越えないよう、
         * ノブの半径を差し引いた範囲に制限する。
         */
        const maximumRadius =
            Math.max(
                1,
                Math.min(
                    baseRect.width,
                    baseRect.height
                ) / 2 -
                Math.max(
                    stickRect.width,
                    stickRect.height
                ) / 2 -
                8
            );

        const distance =
            Math.hypot(rawX, rawY);

        const scale =
            distance > maximumRadius
                ? maximumRadius / distance
                : 1;

        const x = rawX * scale;
        const y = rawY * scale;

        // 左旋回を正、右旋回を負にするためXを反転
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

    if (joystickBase) {
        // スマホのブラウザ標準スクロールを止める
        joystickBase.style.touchAction = "none";
        joystickBase.style.cursor = "grab";
    }

    joystickBase?.addEventListener(
        "pointerdown",
        (event) => {
            if (autoIsRunning) {
                return;
            }

            // 外側の円より外なら反応させない
            if (!isInsideJoystickCircle(event)) {
                return;
            }

            event.preventDefault();

            activePointerId =
                event.pointerId;

            joystickBase.setPointerCapture(
                event.pointerId
            );

            joystickBase.style.cursor =
                "grabbing";

            joystickZone?.classList.add(
                "is-active"
            );

            updateAutoButton();
            updateJoystick(event);
        }
    );

    joystickBase?.addEventListener(
        "pointermove",
        (event) => {
            if (
                autoIsRunning ||
                activePointerId !==
                    event.pointerId
            ) {
                return;
            }

            event.preventDefault();

            /*
             * 円内から操作を始めた後は、指が円外へ出ても
             * 最大位置に固定しながら追従する。
             */
            updateJoystick(event);
        }
    );

    function finishJoystick(event) {
        if (
            activePointerId !== null &&
            activePointerId !==
                event.pointerId
        ) {
            return;
        }

        if (
            joystickBase &&
            joystickBase.hasPointerCapture(
                event.pointerId
            )
        ) {
            joystickBase.releasePointerCapture(
                event.pointerId
            );
        }

        if (joystickBase) {
            joystickBase.style.cursor =
                "grab";
        }

        resetJoystick(true);
    }

    joystickBase?.addEventListener(
        "pointerup",
        finishJoystick
    );

    joystickBase?.addEventListener(
        "pointercancel",
        finishJoystick
    );

    joystickBase?.addEventListener(
        "lostpointercapture",
        () => {
            if (activePointerId !== null) {
                if (joystickBase) {
                    joystickBase.style.cursor =
                        "grab";
                }

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
                document.visibilityState !==
                    "visible"
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

    // 起動直後はジョイスティックを表示
    setRightPanelMode("manual");

    console.log(
        "ジョイスティックの円形判定を有効にしました"
    );
}