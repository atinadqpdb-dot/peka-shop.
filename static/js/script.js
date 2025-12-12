document.addEventListener('DOMContentLoaded', () => {
    // ============================================================
    // 1. متغیرها و انتخابگرهای عمومی
    // ============================================================
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let authFlowState = {};
    let activeCoupon = null; // ذخیره کد تخفیف فعال

    // انتخابگرهای سبد خرید
    const cartIcon = document.getElementById('cartIcon');
    const cartPanel = document.getElementById('cartPanel');
    const cartOverlay = document.getElementById('cartOverlay');
    const closeCartBtn = document.getElementById('closeCart');
    const cartItemsContainer = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    // انتخابگرهای مودال تعداد (افزودن به سبد)
    const quantityModal = document.getElementById('quantityModal');
    const closeQuantityModal = document.getElementById('closeQuantityModal');
    const confirmAddToCartBtn = document.getElementById('confirmAddToCartBtn');
    
    // انتخابگرهای ثبت سفارش و لاگین
    const checkoutModal = document.getElementById('checkoutModal');
    const closeCheckout = document.getElementById('closeCheckout');
    const submitOrder = document.getElementById('submitOrder');
    const loginBtn = document.getElementById('login-btn');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const emailForm = document.getElementById('email-form');
    const passwordForm = document.getElementById('password-form');

    // سایر بخش‌ها
    const searchInput = document.getElementById('searchInput');
    const searchSuggestions = document.getElementById('search-suggestions');
    const slider = document.getElementById('storySlider');

    // انتخابگرهای کد تخفیف
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const couponCodeInput = document.getElementById('couponCode');
    const couponMessage = document.getElementById('couponMessage');

    // ============================================================
    // 2. توابع کمکی
    // ============================================================
    function formatPrice(price) { 
        return new Intl.NumberFormat('fa-IR').format(price); 
    }

    function saveCart() { 
        localStorage.setItem('cart', JSON.stringify(cart)); 
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        if (cartPanel) cartPanel.classList.remove('open');
        if (cartOverlay) cartOverlay.classList.remove('active');
        if (searchSuggestions) searchSuggestions.classList.add('hidden');
    }

    if (cartOverlay) {
        cartOverlay.addEventListener('click', closeAllModals);
    }

    // ============================================================
    // 3. مدیریت دکمه "افزودن به سبد"
    // ============================================================
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('add-to-cart')) {
            e.preventDefault(); 
            e.stopPropagation();
            
            const card = e.target.closest('.product-card');
            if (card) {
                const id = card.dataset.id;
                let name = ""; let price = ""; let imgSrc = "";

                // تلاش برای یافتن اطلاعات محصول از کارت
                if (card.querySelector('.product-name')) name = card.querySelector('.product-name').textContent;
                if (card.querySelector('.product-price')) price = card.querySelector('.product-price').textContent;
                if (card.querySelector('img')) imgSrc = card.querySelector('img').src;

                // پاکسازی قیمت
                price = price.replace(/\D/g, '');
                
                openQuantityModal(id, name, price, imgSrc);
            }
        }
    });

    function openQuantityModal(id, name, price, img) {
        const modalImage = document.getElementById('quantityModalImage');
        const modalName = document.getElementById('quantityModalName');
        const modalQuantity = document.getElementById('quantityModalQuantity');
        const modalTotal = document.getElementById('quantityModalTotal') ? document.getElementById('quantityModalTotal').querySelector('span') : null;

        if(modalImage) modalImage.src = img;
        if(modalName) modalName.textContent = name;
        if(modalQuantity) modalQuantity.textContent = '1';
        if(modalTotal) modalTotal.textContent = `${formatPrice(price)} تومان`;

        // تنظیم داده‌ها روی دکمه تایید نهایی
        if(confirmAddToCartBtn) {
            confirmAddToCartBtn.dataset.id = id;
            confirmAddToCartBtn.dataset.name = name;
            confirmAddToCartBtn.dataset.price = price;
            confirmAddToCartBtn.dataset.image = img;
        }

        if(quantityModal) quantityModal.classList.add('active');
        if(cartOverlay) cartOverlay.classList.add('active');
    }

    // کنترلرهای مثبت و منفی مودال
    const increaseQuantityBtn = document.getElementById('increaseQuantityBtn');
    const decreaseQuantityBtn = document.getElementById('decreaseQuantityBtn');

    if (increaseQuantityBtn) {
        increaseQuantityBtn.addEventListener('click', () => {
            let q = parseInt(document.getElementById('quantityModalQuantity').textContent);
            q++;
            document.getElementById('quantityModalQuantity').textContent = q;
            const price = parseInt(confirmAddToCartBtn.dataset.price);
            const totalSpan = document.getElementById('quantityModalTotal').querySelector('span');
            if(totalSpan) totalSpan.textContent = `${formatPrice(price * q)} تومان`;
        });
    }

    if (decreaseQuantityBtn) {
        decreaseQuantityBtn.addEventListener('click', () => {
            let q = parseInt(document.getElementById('quantityModalQuantity').textContent);
            if (q > 1) {
                q--;
                document.getElementById('quantityModalQuantity').textContent = q;
                const price = parseInt(confirmAddToCartBtn.dataset.price);
                const totalSpan = document.getElementById('quantityModalTotal').querySelector('span');
                if(totalSpan) totalSpan.textContent = `${formatPrice(price * q)} تومان`;
            }
        });
    }

    // تایید افزودن به سبد
    if (confirmAddToCartBtn) {
        confirmAddToCartBtn.addEventListener('click', function() {
            const id = this.dataset.id;
            const name = this.dataset.name;
            const price = parseInt(this.dataset.price);
            const quantity = parseInt(document.getElementById('quantityModalQuantity').textContent);
            
            const existingItem = cart.find(item => item.id == id);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({ id, name, price, quantity });
            }
            
            // ریست تخفیف چون سبد تغییر کرده
            activeCoupon = null;
            if(couponMessage) couponMessage.textContent = '';
            if(couponCodeInput) couponCodeInput.value = '';

            // انیمیشن پرواز
            const sourceImg = document.getElementById('quantityModalImage');
            if(sourceImg) flyToCart(sourceImg);
            
            setTimeout(() => {
                closeAllModals();
                updateCartUI();
            }, 500);
        });
    }

    // ============================================================
    // 4. منطق سبد خرید و کد تخفیف
    // ============================================================
    function updateCartCount() {
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        const cartCountElement = cartIcon.querySelector('.cart-count');
        if (cartCountElement) cartCountElement.textContent = totalItems;
    }
    
    function updateCartUI() {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';
        
        let total = 0;
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p style="text-align: center; margin-top: 20px;">سبد خرید شما خالی است</p>';
            activeCoupon = null;
        } else {
            cart.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">${formatPrice(item.price)} تومان</div>
                        <div class="cart-item-actions">
                            <span class="cart-item-quantity">تعداد: ${item.quantity}</span>
                            <button class="cart-item-remove" data-id="${item.id}">حذف</button>
                        </div>
                    </div>`;
                cartItemsContainer.appendChild(itemElement);
                total += item.price * item.quantity;
            });
        }

        // محاسبات مالی
        const subTotalEl = document.getElementById('cartSubTotal');
        const discountRow = document.getElementById('discountRow');
        const discountEl = document.getElementById('cartDiscount');
        const finalTotalEl = document.getElementById('cartFinalTotal');

        if(subTotalEl) subTotalEl.textContent = `${formatPrice(total)} تومان`;
        
        let discountAmount = 0;
        if (activeCoupon && total > 0) {
            discountAmount = activeCoupon.amount;
            if (discountAmount > total) discountAmount = total;

            if(discountRow) discountRow.style.display = 'flex';
            if(discountEl) discountEl.textContent = `${formatPrice(discountAmount)} تومان`;
        } else {
            if(discountRow) discountRow.style.display = 'none';
        }

        if(finalTotalEl) finalTotalEl.textContent = `${formatPrice(total - discountAmount)} تومان`;
        
        updateCartCount();
        saveCart();
    }

    if (cartIcon) cartIcon.addEventListener('click', e => { e.preventDefault(); cartPanel.classList.add('open'); cartOverlay.classList.add('active'); updateCartUI(); });
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeAllModals);
    
    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', e => {
            if (e.target.classList.contains('cart-item-remove')) {
                const itemId = e.target.dataset.id;
                const itemIndex = cart.findIndex(item => item.id == itemId);
                if (itemIndex > -1) { 
                    cart.splice(itemIndex, 1); 
                    activeCoupon = null;
                    updateCartUI(); 
                }
            }
        });
    }

    // --- اعمال کد تخفیف ---
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponCodeInput.value.trim();
            const msgEl = document.getElementById('couponMessage');
            
            if (!code || cart.length === 0) return;
            
            applyCouponBtn.textContent = '...';
            try {
                const response = await fetch('/api/validate-coupon/', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        code: code,
                        items: cart 
                    })
                });
                const result = await response.json();
                
                if (result.success) {
                    activeCoupon = { 
                        code: code, 
                        amount: result.discount_amount 
                    };
                    msgEl.textContent = `تخفیف اعمال شد! (${formatPrice(result.discount_amount)} تومان)`;
                    msgEl.style.color = 'green';
                    updateCartUI();
                } else {
                    activeCoupon = null;
                    updateCartUI();
                    msgEl.textContent = result.message;
                    msgEl.style.color = 'red';
                }
            } catch (e) {
                msgEl.textContent = "خطا در برقراری ارتباط.";
                msgEl.style.color = "red";
            } finally {
                applyCouponBtn.textContent = 'اعمال';
            }
        });
    }

    function flyToCart(startElement) {
        const flyingImage = startElement.cloneNode(true);
        const startRect = startElement.getBoundingClientRect();
        const cartRect = cartIcon.getBoundingClientRect();
        flyingImage.style.position = 'fixed'; flyingImage.style.zIndex = '2000';
        flyingImage.style.left = `${startRect.left}px`; flyingImage.style.top = `${startRect.top}px`;
        flyingImage.style.width = `${startRect.width}px`; flyingImage.style.height = `${startRect.height}px`;
        flyingImage.style.transition = 'all 0.8s ease-in-out'; flyingImage.style.borderRadius = '15px';
        document.body.appendChild(flyingImage);
        requestAnimationFrame(() => {
            flyingImage.style.left = `${cartRect.left}px`; flyingImage.style.top = `${cartRect.top}px`;
            flyingImage.style.width = '20px'; flyingImage.style.height = '20px'; flyingImage.style.opacity = '0';
        });
        setTimeout(() => { flyingImage.remove(); }, 800);
    }

    // ============================================================
    // 5. ثبت سفارش و اتصال به درگاه پرداخت
    // ============================================================
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => { 
        if (cart.length === 0) return alert('سبد خالی است!'); 
        cartPanel.classList.remove('open'); 
        checkoutModal.classList.add('active'); 
        cartOverlay.classList.add('active'); 
    });
    
    if (closeCheckout) closeCheckout.addEventListener('click', closeAllModals);
    
    if (submitOrder) {
        submitOrder.addEventListener('click', async () => {
            const fullname = document.getElementById('fullname').value;
            const phone = document.getElementById('phone').value;
            const address = document.getElementById('address').value;
            
            if (!fullname || !phone || !address) return alert('اطلاعات کامل نیست');

            submitOrder.textContent = 'در حال اتصال به درگاه...';
            submitOrder.disabled = true;

            try {
                const response = await fetch('/create-order/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullname, phone, address, items: cart,
                        coupon_code: activeCoupon ? activeCoupon.code : null
                    })
                });
                const result = await response.json();
                
                if (result.success) {
                    // اگر لینک پرداخت وجود داشت، هدایت کن
                    if (result.payment_url) {
                        window.location.href = result.payment_url;
                    } else {
                        // اگر مبلغ 0 بود (تخفیف 100%)
                        alert(`سفارش شماره ${result.order_id} با موفقیت ثبت شد!`);
                        localStorage.removeItem('cart');
                        cart = [];
                        activeCoupon = null;
                        updateCartUI();
                        window.location.href = '/profile/';
                    }
                } else {
                    alert('خطا: ' + result.message);
                    submitOrder.disabled = false;
                    submitOrder.textContent = 'ثبت نهایی سفارش';
                }
            } catch (e) { 
                alert('خطا در برقراری ارتباط با سرور'); 
                submitOrder.disabled = false;
                submitOrder.textContent = 'ثبت نهایی سفارش';
            }
        });
    }

    // ============================================================
    // 6. لاگین و ثبت نام
    // ============================================================
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.add('active');
            cartOverlay.classList.add('active');
            document.getElementById('email-step').style.display = 'block';
            document.getElementById('password-step').style.display = 'none';
        });
    }
    if (closeAuthModal) closeAuthModal.addEventListener('click', closeAllModals);

    if (emailForm) {
        emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            authFlowState.email = document.getElementById('email-input').value;
            document.getElementById('email-step').style.display = 'none';
            document.getElementById('password-step').style.display = 'block';
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password-input').value;
            const btn = passwordForm.querySelector('button');
            btn.textContent = '...'; btn.disabled = true;
            try {
                let response = await fetch('/api/login/', { method: 'POST', body: JSON.stringify({ email: authFlowState.email, password: password }) });
                let result = await response.json();
                if (result.success) { location.reload(); } 
                else if (confirm("کاربر یافت نشد. ثبت‌نام می‌کنید؟")) {
                     const name = prompt("نام شما:");
                     if (name) {
                         response = await fetch('/api/register/', { method: 'POST', body: JSON.stringify({ email: authFlowState.email, password: password, name: name }) });
                         if ((await response.json()).success) { alert("ثبت‌نام شد."); location.reload(); }
                     }
                } else { alert(result.message); }
            } catch (error) { console.error(error); } finally { btn.textContent = 'ورود'; btn.disabled = false; }
        });
    }

    // ============================================================
    // 7. جستجو، اسلایدر و هوش مصنوعی
    // ============================================================
    if (searchInput && searchSuggestions) {
        let timeout = null;
        searchInput.addEventListener('input', function() {
            const query = this.value.trim(); clearTimeout(timeout);
            if (query.length < 2) { searchSuggestions.classList.add('hidden'); return; }
            timeout = setTimeout(() => {
                fetch(`/search-suggestions/?q=${encodeURIComponent(query)}`).then(r => r.json()).then(data => {
                    searchSuggestions.innerHTML = '';
                    if (data.results.length > 0) {
                        searchSuggestions.classList.remove('hidden');
                        data.results.forEach(p => {
                            const div = document.createElement('div'); div.className = 'suggestion-item';
                            div.innerHTML = `<img src="${p.image || 'https://via.placeholder.com/40'}" alt="${p.name}"><div class="suggestion-item-name">${p.name}</div>`;
                            div.addEventListener('click', () => { window.location.href = `/?q=${p.name}`; });
                            searchSuggestions.appendChild(div);
                        });
                    } else searchSuggestions.classList.add('hidden');
                });
            }, 300);
        });
        document.addEventListener('click', (e) => { if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) searchSuggestions.classList.add('hidden'); });
    }

    if (slider) {
        const slidesWrapper = document.getElementById('slidesWrapper'); const dotsContainer = document.getElementById('sliderDots'); const slides = document.querySelectorAll('.slide'); const slideCount = slides.length; let currentSlide = 0; let slideInterval;
        if (dotsContainer && slideCount > 0) {
            dotsContainer.innerHTML = '';
            for (let i = 0; i < slideCount; i++) {
                const dot = document.createElement('div'); dot.classList.add('dot'); if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => { goToSlide(i); resetInterval(); }); dotsContainer.appendChild(dot);
            }
        }
        function goToSlide(idx) { if (!slidesWrapper) return; slidesWrapper.style.transform = `translateX(${idx * 100}%)`; const dots = document.querySelectorAll('.dot'); dots.forEach(d => d.classList.remove('active')); if (dots[idx]) dots[idx].classList.add('active'); currentSlide = idx; }
        function nextSlide() { goToSlide((currentSlide + 1) % slideCount); }
        function prevSlide() { goToSlide((currentSlide - 1 + slideCount) % slideCount); }
        function startInterval() { if (slideCount > 1) slideInterval = setInterval(nextSlide, 5000); }
        function resetInterval() { clearInterval(slideInterval); startInterval(); }
        const prev = document.getElementById('prevBtn'); const next = document.getElementById('nextBtn');
        if (prev) prev.addEventListener('click', () => { prevSlide(); resetInterval(); });
        if (next) next.addEventListener('click', () => { nextSlide(); resetInterval(); });
        slider.addEventListener('mouseenter', () => clearInterval(slideInterval)); slider.addEventListener('mouseleave', startInterval); startInterval();
    }

    const aiIntroContainer = document.getElementById('ai-intro-container'); const aiChatWindow = document.getElementById('ai-chat-window'); const aiChatBody = document.getElementById('ai-chat-body'); const aiChatForm = document.getElementById('ai-chat-form'); const aiChatInput = document.getElementById('ai-chat-input'); const closeChatBtn = aiChatWindow ? aiChatWindow.querySelector('.close-chat-btn') : null; const promptYesBtn = document.getElementById('ai-prompt-yes'); const promptNoBtn = document.getElementById('ai-prompt-no'); const aiDockStation = document.getElementById('ai-dock-station');
    const aiState = sessionStorage.getItem('aiState') || 'intro'; 
    function initAI() {
        if (!aiIntroContainer) return;
        if (aiState === 'intro') { aiIntroContainer.classList.remove('hidden'); aiDockStation.classList.add('hidden'); aiChatWindow.classList.remove('open'); }
        else if (aiState === 'docked') { aiIntroContainer.classList.add('hidden'); aiDockStation.classList.remove('hidden'); aiChatWindow.classList.remove('open'); }
        else if (aiState === 'open') { aiIntroContainer.classList.add('hidden'); aiDockStation.classList.remove('hidden'); aiDockStation.style.transform = 'scale(0.9)'; aiChatWindow.classList.add('open'); }
    }
    const setAiState = (s) => sessionStorage.setItem('aiState', s);

    if (promptYesBtn) promptYesBtn.addEventListener('click', () => { aiIntroContainer.classList.add('hidden'); aiDockStation.classList.remove('hidden'); aiChatWindow.classList.add('open'); setAiState('open'); });
    if (promptNoBtn) promptNoBtn.addEventListener('click', () => { aiIntroContainer.classList.add('hidden'); aiDockStation.classList.remove('hidden'); setAiState('docked'); });
    if (aiDockStation) aiDockStation.addEventListener('click', () => { if (aiChatWindow.classList.contains('open')) { aiChatWindow.classList.remove('open'); setAiState('docked'); } else { aiChatWindow.classList.add('open'); setAiState('open'); } });
    if (closeChatBtn) closeChatBtn.addEventListener('click', () => { aiChatWindow.classList.remove('open'); setAiState('docked'); });
    if (aiChatForm) aiChatForm.addEventListener('submit', async e => {
        e.preventDefault(); const text = aiChatInput.value.trim(); if(!text) return;
        const msg = document.createElement('div'); msg.className = 'chat-message user'; msg.textContent = text;
        aiChatBody.appendChild(msg); aiChatInput.value = ''; aiChatBody.scrollTop = aiChatBody.scrollHeight;
        const t = document.createElement('div'); t.className = 'chat-message assistant'; t.textContent = '...'; aiChatBody.appendChild(t);
        try {
            const response = await fetch('/api/ai-chat/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
            const result = await response.json(); t.textContent = result.response;
        } catch (error) { t.textContent = "ارتباط با سرور قطع شد."; }
        aiChatBody.scrollTop = aiChatBody.scrollHeight;
    });

    // ================== 9. راه‌اندازی اولیه ==================
    if (cartIcon && cartIcon.innerHTML.trim() === '') {
        const c = document.createElement('div'); c.className = 'cart-count';
        const i = document.createElement('div'); i.className = 'cart-icon-container'; i.textContent = '🛒'; i.appendChild(c);
        cartIcon.appendChild(i);
    }
    if(closeQuantityModal) closeQuantityModal.addEventListener('click', closeAllModals);
    updateCartUI();
    initAI();
});