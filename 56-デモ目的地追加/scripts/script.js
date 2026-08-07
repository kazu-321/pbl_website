console.log("script.js ROS settings version loaded");

// =========================================================
// ROS接続設定
// =========================================================

// 初期状態のホスト名
const DEFAULT_ROS_HOST =
    "kazubuntu24.local";

// ブラウザへ保存するときの名前
const ROS_HOST_STORAGE_KEY =
    "robotRosHost";

// rosbridgeのポート番号
const ROS_PORT = 9090;


/*
 * 入力された接続先から、
 * ホスト名またはIPアドレスだけを取り出す
 *
 * 入力例：
 * kazubuntu24.local
 * 172.20.10.2
 * ws://172.20.10.2:9090
 */
function normalizeRosHost(value) {

    let host =
        String(value ?? "").trim();

    // ws:// または wss:// を削除
    host = host.replace(
        /^wss?:\/\//i,
        ""
    );

    // /以降を削除
    host =
        host.split("/")[0];

    // :9090が入力されていた場合は削除
    host = host.replace(
        /:9090$/i,
        ""
    );

    return host.trim();
}


/*
 * ホスト名・IPv4アドレスとして
 * 使用可能な文字か確認する
 */
function isValidRosHost(host) {

    if (!host) {
        return false;
    }

    return /^[a-zA-Z0-9.-]+$/.test(
        host
    );
}


/*
 * 保存されている接続先を取得する。
 * 保存されていなければ初期値を使用する。
 */
function getSavedRosHost() {

    const savedHost =
        localStorage.getItem(
            ROS_HOST_STORAGE_KEY
        );

    const normalizedHost =
        normalizeRosHost(
            savedHost
        );

    if (
        normalizedHost &&
        isValidRosHost(normalizedHost)
    ) {
        return normalizedHost;
    }

    return DEFAULT_ROS_HOST;
}


// 現在使用するホスト名
const rosHost =
    getSavedRosHost();

// ROS接続URL
const rosUrl =
    `ws://${rosHost}:${ROS_PORT}`;

console.log(
    "ROS接続先:",
    rosUrl
);


// =========================================================
// ROS
// =========================================================

const ros = new ROSLIB.Ros({
    url: rosUrl
});

const connection_status =
    document.getElementById(
        "connection-status"
    );


// =========================================================
// Goal Publisher
// =========================================================

initializeGoalPublisher(ros);


// =========================================================
// Connection
// =========================================================

ros.on("connection", () => {

    console.log(
        "Connected:",
        rosUrl
    );

    if (connection_status) {
        connection_status.textContent =
            "接続中";
    }

    subscribeMap();
    subscribePath();
    subscribePose();
    subscribeSpeed();
});


ros.on("close", () => {

    console.log(
        "Disconnected:",
        rosUrl
    );

    if (connection_status) {
        connection_status.textContent =
            "未接続";
    }
});


ros.on("error", error => {

    console.error(
        "ROS connection error:",
        error
    );

    if (connection_status) {
        connection_status.textContent =
            "接続エラー";
    }
});


// =========================================================
// Controller
// =========================================================

initializeController(ros);


// =========================================================
// 設定画面
// =========================================================

function initializeRosSettings() {

    /*
     * メニュー内から「設定」と書かれた項目を探す
     */
    const settingsMenuItem =
        [
            ...document.querySelectorAll(
                ".side-menu .menu-item"
            )
        ].find(element => {

            return element
                .textContent
                .includes("設定");
        });


    if (!settingsMenuItem) {

        console.warn(
            "設定メニューが見つかりません"
        );

        return;
    }


    // ボタンとして操作できるようにする
    settingsMenuItem.setAttribute(
        "role",
        "button"
    );

    settingsMenuItem.setAttribute(
        "tabindex",
        "0"
    );


    // =====================================================
    // 設定画面のHTMLを作成
    // =====================================================

    const settingsModal =
        document.createElement(
            "div"
        );

    settingsModal.id =
        "ros-settings-modal";

    settingsModal.className =
        "modal";

    settingsModal.setAttribute(
        "aria-hidden",
        "true"
    );


    settingsModal.innerHTML = `
        <div
            class="modal-box glass ros-settings-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ros-settings-title"
        >
            <h2 id="ros-settings-title">
                ROS接続設定
            </h2>

            <p class="ros-settings-description">
                Ubuntuのホスト名または
                IPアドレスを入力してください。
            </p>

            <label
                class="ros-settings-label"
                for="ros-host-input"
            >
                接続先
            </label>

            <input
                id="ros-host-input"
                class="ros-settings-input"
                type="text"
                inputmode="url"
                autocomplete="off"
                spellcheck="false"
                placeholder="kazubuntu24.local"
            >

            <p class="ros-settings-preview">
                接続URL：
                <span id="ros-url-preview"></span>
            </p>

            <p
                class="ros-settings-error"
                id="ros-settings-error"
            ></p>

            <div class="modal-buttons">

                <button
                    class="modal-btn cancel"
                    id="cancel-ros-settings"
                    type="button"
                >
                    キャンセル
                </button>

                <button
                    class="modal-btn confirm ros-settings-save"
                    id="save-ros-settings"
                    type="button"
                >
                    保存
                </button>

            </div>
        </div>
    `;

    document.body.appendChild(
        settingsModal
    );


    // =====================================================
    // 設定画面用CSS
    // =====================================================

    const settingsStyle =
        document.createElement(
            "style"
        );

    settingsStyle.textContent = `
        .ros-settings-box {
            width: min(420px, 100%);
            text-align: left;
        }

        .ros-settings-box h2 {
            text-align: center;
        }

        .ros-settings-description {
            margin-bottom: 18px !important;
            text-align: center;
        }

        .ros-settings-label {
            display: block;
            margin-bottom: 7px;
            color: #cbd5e1;
            font-size: 14px;
            font-weight: 700;
        }

        .ros-settings-input {
            width: 100%;
            height: 50px;
            padding: 0 14px;

            border: 1px solid
                rgba(148, 163, 184, 0.28);

            border-radius: 14px;

            outline: none;

            background:
                rgba(15, 23, 42, 0.72);

            color: white;
            font-size: 16px;
        }

        .ros-settings-input:focus {
            border-color: #60a5fa;

            box-shadow:
                0 0 0 3px
                rgba(59, 130, 246, 0.16);
        }

        .ros-settings-preview {
            margin: 10px 0 0 !important;

            color: #94a3b8;
            font-size: 12px;
            overflow-wrap: anywhere;
        }

        .ros-settings-error {
            min-height: 22px;
            margin: 6px 0 8px !important;

            color: #fb7185;
            font-size: 12px;
        }

        .ros-settings-save {
            background:
                linear-gradient(
                    90deg,
                    #3b82f6,
                    #7c3aed
                );
        }

        body.light-mode
        .ros-settings-label {
            color: #334155;
        }

        body.light-mode
        .ros-settings-input {
            border-color: #cbd5e1;
            background: white;
            color: #111827;
        }

        body.light-mode
        .ros-settings-preview {
            color: #64748b;
        }

        @media screen and
        (max-width: 900px) {

            .ros-settings-box {
                width: min(
                    calc(100vw - 28px),
                    420px
                );

                padding: 22px;
            }

            .ros-settings-input {
                font-size: 16px;
            }
        }
    `;

    document.head.appendChild(
        settingsStyle
    );


    // =====================================================
    // Elements
    // =====================================================

    const hostInput =
        document.getElementById(
            "ros-host-input"
        );

    const urlPreview =
        document.getElementById(
            "ros-url-preview"
        );

    const errorText =
        document.getElementById(
            "ros-settings-error"
        );

    const cancelButton =
        document.getElementById(
            "cancel-ros-settings"
        );

    const saveButton =
        document.getElementById(
            "save-ros-settings"
        );


    // =====================================================
    // Preview
    // =====================================================

    function updateRosUrlPreview() {

        const previewHost =
            normalizeRosHost(
                hostInput.value
            ) || DEFAULT_ROS_HOST;

        urlPreview.textContent =
            `ws://${previewHost}:${ROS_PORT}`;
    }


    hostInput.addEventListener(
        "input",
        () => {

            errorText.textContent =
                "";

            updateRosUrlPreview();
        }
    );


    // =====================================================
    // Open / Close
    // =====================================================

    function openRosSettings() {

        hostInput.value =
            getSavedRosHost();

        errorText.textContent =
            "";

        updateRosUrlPreview();

        settingsModal.classList.add(
            "show"
        );

        settingsModal.setAttribute(
            "aria-hidden",
            "false"
        );


        /*
         * サイドメニューを閉じる
         */
        document
            .getElementById(
                "side-menu"
            )
            ?.classList.remove(
                "show"
            );

        document
            .getElementById(
                "menu-overlay"
            )
            ?.classList.remove(
                "show"
            );

        document
            .getElementById(
                "menu-btn"
            )
            ?.setAttribute(
                "aria-expanded",
                "false"
            );


        window.setTimeout(
            () => {

                hostInput.focus();
                hostInput.select();
            },
            50
        );
    }


    function closeRosSettings() {

        settingsModal.classList.remove(
            "show"
        );

        settingsModal.setAttribute(
            "aria-hidden",
            "true"
        );

        errorText.textContent =
            "";
    }


    // =====================================================
    // Save
    // =====================================================

    function saveRosSettings() {

        const newHost =
            normalizeRosHost(
                hostInput.value
            );


        if (!newHost) {

            errorText.textContent =
                "接続先を入力してください。";

            hostInput.focus();

            return;
        }


        if (!isValidRosHost(newHost)) {

            errorText.textContent =
                "ホスト名またはIPアドレスを正しく入力してください。";

            hostInput.focus();

            return;
        }


        localStorage.setItem(
            ROS_HOST_STORAGE_KEY,
            newHost
        );


        /*
         * 新しい接続先で接続し直すため、
         * ページを再読み込みする
         */
        window.location.reload();
    }


    // =====================================================
    // Events
    // =====================================================

    settingsMenuItem.addEventListener(
        "click",
        openRosSettings
    );


    settingsMenuItem.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                openRosSettings();
            }
        }
    );


    cancelButton.addEventListener(
        "click",
        closeRosSettings
    );


    saveButton.addEventListener(
        "click",
        saveRosSettings
    );


    hostInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                saveRosSettings();
            }
        }
    );


    /*
     * 設定ボックスの外側を押したら閉じる
     */
    settingsModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                settingsModal
            ) {

                closeRosSettings();
            }
        }
    );


    /*
     * Escapeキーで閉じる
     */
    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                settingsModal.classList
                    .contains("show")
            ) {

                closeRosSettings();
            }
        }
    );
}


// DOM読み込み後に設定機能を開始
if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeRosSettings
    );

} else {

    initializeRosSettings();
}


// =========================================================
// Draw Loop
// =========================================================

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