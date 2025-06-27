'use strict';

document.addEventListener('DOMContentLoaded', () => {

    // --------------------------------------------------
    // 1. スクロールでヘッダーを変化させる
    // --------------------------------------------------
    const header = document.querySelector('.header-section');
    if (header) {
        window.addEventListener('scroll', () => {
            // 50px以上スクロールされたら 'scrolled' クラスを付与
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }


    // --------------------------------------------------
    // 2. 要素が画面に入ったらアニメーションを発動させる
    // --------------------------------------------------
    // Intersection Observer API を利用して、要素の表示・非表示を監視する
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // isIntersectingプロパティがtrue = 画面に表示された
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // 一度表示されたら監視を停止する
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // 要素が10%見えたら発動
    });

    // 'animate-on-scroll' クラスを持つすべての要素を監視対象にする
    const targets = document.querySelectorAll('.animate-on-scroll');
    targets.forEach(target => {
        observer.observe(target);
    });

});