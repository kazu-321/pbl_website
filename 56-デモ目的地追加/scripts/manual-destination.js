console.log("manual-destination.js loaded");

// =========================================================
// 手動操作中は目的地カードをジョイスティックの下へ表示
// 自動運転中は元の右側カード領域へ戻す
// =========================================================

(function initializeManualDestinationLayout() {

    const destinationCard =
        document.querySelector(
            ".destination-card"
        );

    const manualControlPanel =
        document.getElementById(
            "manual-control-panel"
        );

    const sideCards =
        document.querySelector(
            ".side-cards"
        );


    // 必要な要素がない場合
    if (
        !destinationCard ||
        !manualControlPanel ||
        !sideCards
    ) {
        console.error(
            "目的地カード移動用の要素が見つかりません",
            {
                destinationCard,
                manualControlPanel,
                sideCards
            }
        );

        return;
    }


    // =====================================================
    // ジョイスティックの下に目的地カード用の場所を作る
    // =====================================================

    let manualDestinationSlot =
        document.getElementById(
            "manual-destination-slot"
        );

    if (!manualDestinationSlot) {

        manualDestinationSlot =
            document.createElement(
                "div"
            );

        manualDestinationSlot.id =
            "manual-destination-slot";

        manualDestinationSlot.className =
            "manual-destination-slot";

        /*
         * manual-control-cardの後ろへ追加されるので、
         * ジョイスティックの下に表示される
         */
        manualControlPanel.appendChild(
            manualDestinationSlot
        );
    }


    // =====================================================
    // 目的地カードの元の位置を記録
    // =====================================================

    const destinationHomeMarker =
        document.createComment(
            "destination-card-home"
        );

    sideCards.insertBefore(
        destinationHomeMarker,
        destinationCard
    );


    // =====================================================
    // 手動操作画面へ移動
    // =====================================================

    function moveDestinationToManualPanel() {

        if (
            destinationCard.parentElement ===
            manualDestinationSlot
        ) {
            return;
        }

        manualDestinationSlot.appendChild(
            destinationCard
        );

        console.log(
            "目的地カードをジョイスティックの下へ移動しました"
        );
    }


    // =====================================================
    // 自動運転画面へ戻す
    // =====================================================

    function restoreDestinationToAutoPanel() {

        if (!destinationHomeMarker.parentNode) {
            return;
        }

        if (
            destinationCard.parentElement ===
            sideCards
        ) {
            return;
        }

        /*
         * 目的地カードをルート情報より前へ戻す
         */
        destinationHomeMarker.parentNode
            .insertBefore(
                destinationCard,
                destinationHomeMarker.nextSibling
            );

        console.log(
            "目的地カードを自動運転画面へ戻しました"
        );
    }


    // =====================================================
    // 表示モードに合わせて移動
    // =====================================================

    function syncDestinationPosition() {

        const isManualView =
            document.body.classList.contains(
                "manual-view"
            );

        if (isManualView) {

            moveDestinationToManualPanel();

        } else {

            restoreDestinationToAutoPanel();
        }
    }


    // =====================================================
    // manual-view / auto-view の切り替えを監視
    // =====================================================

    const bodyClassObserver =
        new MutationObserver(
            syncDestinationPosition
        );

    bodyClassObserver.observe(
        document.body,
        {
            attributes: true,
            attributeFilter: [
                "class"
            ]
        }
    );


    // スマホでページを戻したときにも位置を再確認
    window.addEventListener(
        "pageshow",
        syncDestinationPosition
    );


    // =====================================================
    // 必要なCSSを自動追加
    // =====================================================

    if (
        !document.getElementById(
            "manual-destination-layout-style"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "manual-destination-layout-style";

        style.textContent = `
            /* 手動操作中のパネルを縦に並べる */
            body.manual-view .manual-control-panel {
                display: flex !important;
                flex-direction: column;
                gap: 12px;

                min-height: 0;
                overflow-y: auto;
                overscroll-behavior: contain;
                -webkit-overflow-scrolling: touch;
            }

            /* 通常は目的地用スペースを隠す */
            .manual-destination-slot {
                display: none;
                width: 100%;
                flex: 0 0 auto;
            }

            /* 手動操作中だけ表示 */
            body.manual-view .manual-destination-slot {
                display: block;
            }

            /* 移動した目的地カードを横幅いっぱいにする */
            .manual-destination-slot .destination-card {
                width: 100%;
                margin: 0;
            }

            /* 自動運転画面では非表示 */
            body.auto-view .manual-destination-slot {
                display: none;
            }

            @media screen and (max-width: 900px) {
                body.manual-view .manual-control-panel {
                    padding-bottom: 16px;
                }

                .manual-destination-slot {
                    padding-bottom: 12px;
                }

                /*
                 * スマホではジョイスティックの下まで
                 * 縦スクロールできる
                 */
                .manual-destination-slot .destination-card {
                    flex: 0 0 auto;
                    border-radius: 20px;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }


    // 最初の表示状態を反映
    syncDestinationPosition();

})();