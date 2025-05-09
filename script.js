document.addEventListener('DOMContentLoaded', () => {

    const ACCESS_CODE = "2724";

    // ****** MODIFIED PRODUCT DATA WITH DESCRIPTIONS ******
    let products = [
        { id: 1, name: "Margherita Pizza", description: "Classic pizza with fresh mozzarella, tomatoes, and basil on a thin crust.", price: 350, stock: 20 },
        { id: 2, name: "Chicken Biryani", description: "Aromatic basmati rice cooked with tender chicken and exotic spices.", price: 280, stock: 30 },
        { id: 3, name: "Paneer Butter Masala", description: "Soft paneer cubes in a rich, creamy tomato and butter gravy.", price: 220, stock: 25 },
        { id: 4, name: "Veg Hakka Noodles", description: "Stir-fried noodles with mixed vegetables in a savory sauce.", price: 180, stock: 35 },
        { id: 5, name: "Masala Dosa", description: "Crispy rice crepe filled with spiced mashed potatoes, served with sambar and chutney.", price: 150, stock: 40 },
        { id: 6, name: "Chole Bhature", description: "Spicy chickpea curry served with fluffy deep-fried bread.", price: 160, stock: 20 },
        { id: 7, name: "Dal Makhani", description: "Creamy black lentils and kidney beans slow-cooked with butter and spices.", price: 190, stock: 22 },
        { id: 8, name: "Butter Chicken", description: "Tender chicken pieces in a mildly spiced tomato, butter, and cream sauce.", price: 320, stock: 15 },
        { id: 9, name: "Fish Curry", description: "Tangy and spicy fish curry made with coconut milk and regional spices.", price: 300, stock: 18 },
        { id: 10, name: "Gulab Jamun (2 pcs)", description: "Sweet, deep-fried milk solids dumplings soaked in sugar syrup.", price: 80, stock: 50 },
        { id: 11, name: "Coca-Cola (Can)", description: "Chilled 300ml can of Coca-Cola.", price: 40, stock: 100 },
        { id: 12, name: "Fresh Lime Soda", description: "Refreshing sweet and salty soda with fresh lime juice.", price: 60, stock: 60 },
        { id: 13, name: "Garlic Naan", description: "Soft Indian flatbread flavored with garlic and butter.", price: 50, stock: 70 },
        { id: 14, name: "Steamed Rice", description: "Plain, perfectly steamed basmati rice.", price: 90, stock: 50 },
        { id: 15, name: "Veg Fried Rice", description: "Basmati rice stir-fried with assorted vegetables and soy sauce.", price: 170, stock: 30 },
        { id: 16, name: "Chicken Tikka Masala", description: "Roasted marinated chicken chunks (chicken tikka) in a spiced curry sauce.", price: 340, stock: 12 },
        { id: 17, name: "Mutton Rogan Josh", description: "Aromatic Kashmiri lamb curry with a rich gravy.", price: 450, stock: 10 },
        { id: 18, name: "Rasmalai (2 pcs)", description: "Spongy cottage cheese dumplings soaked in creamy saffron milk.", price: 100, stock: 30 },
        { id: 19, name: "Mineral Water (Bottle)", description: "Purified packaged drinking water (1 litre).", price: 20, stock: 150 },
        { id: 20, name: "Mixed Veg Curry", description: "Assorted seasonal vegetables cooked in a flavorful onion-tomato gravy.", price: 200, stock: 25 }
    ];
    // ****** END OF MODIFIED PRODUCT DATA ******

    let currentOrder = {};
    let orderHistory = [];

    const lockScreenDiv = document.getElementById('lockScreen');
    const accessCodeInput = document.getElementById('accessCodeInput');
    const unlockBtn = document.getElementById('unlockBtn');
    const lockErrorMsg = document.getElementById('lockError');
    const appContainerDiv = document.getElementById('appContainer');

    const productTableBody = document.getElementById('productTableBody');
    const currentOrderItemsDiv = document.getElementById('currentOrderItems');
    const currentOrderTotalSpan = document.getElementById('currentOrderTotal');
    const customerNameInput = document.getElementById('customerNameInput');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const orderLogDiv = document.getElementById('orderLog');

    const stockProductSelect = document.getElementById('stockProductSelect');
    const currentStockDisplay = document.getElementById('currentStockDisplay');
    const newStockInput = document.getElementById('newStockInput');
    const updateStockBtn = document.getElementById('updateStockBtn');
    const stockUpdateMsg = document.getElementById('stockUpdateMsg');

    if (unlockBtn) unlockBtn.addEventListener('click', handleUnlock);
    if (accessCodeInput) accessCodeInput.addEventListener('keypress', (e) => { if (e.key === "Enter") handleUnlock(); });
    if (placeOrderBtn) placeOrderBtn.addEventListener('click', handlePlaceOrder);
    if (stockProductSelect) stockProductSelect.addEventListener('change', handleStockProductSelectChange);
    if (updateStockBtn) updateStockBtn.addEventListener('click', handleUpdateStock);

    if (orderLogDiv) {
        orderLogDiv.addEventListener('change', handleOrderStatusChange);
        orderLogDiv.addEventListener('click', handleDeleteOrderClick);
    }

    function handleUnlock() {
        if (!accessCodeInput || !lockScreenDiv || !appContainerDiv || !lockErrorMsg) return;
        if (accessCodeInput.value === ACCESS_CODE) {
            lockScreenDiv.style.display = 'none';
            appContainerDiv.style.display = 'block';
            initializeSystem();
        } else {
            lockErrorMsg.style.display = 'block';
            accessCodeInput.value = '';
            accessCodeInput.focus();
            setTimeout(() => { lockErrorMsg.style.display = 'none'; }, 3000);
        }
    }

    function initializeSystem() {
        renderProducts();
        updateCurrentOrderDisplay();
        populateStockManagementDropdown();
        handleStockProductSelectChange();
        renderOrderHistory();
    }

    // ****** MODIFIED renderProducts TO INCLUDE DESCRIPTION ******
    function renderProducts() {
        if (!productTableBody) return;
        productTableBody.innerHTML = '';
        products.forEach(product => {
            const row = productTableBody.insertRow();
            const quantityInOrder = currentOrder[product.id] || 0;
            row.innerHTML = `
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.description || 'N/A'}</td> <!-- Display description -->
                <td>₹${product.price.toFixed(2)}</td>
                <td id="stock-${product.id}">${product.stock}</td>
                <td class="quantity-control-cell">
                    <div class="quantity-control">
                        <button class="quantity-btn minus-btn" data-product-id="${product.id}" data-action="decrement" ${quantityInOrder === 0 ? 'disabled' : ''}>-</button>
                        <span class="quantity-display" id="qty-display-${product.id}">${quantityInOrder}</span>
                        <button class="quantity-btn plus-btn" data-product-id="${product.id}" data-action="increment" ${quantityInOrder >= product.stock ? 'disabled' : ''}>+</button>
                    </div>
                </td>
            `;
        });
        document.querySelectorAll('.quantity-btn').forEach(button => {
            button.addEventListener('click', handleQuantityButtonClick);
        });
    }
    // ****** END OF renderProducts MODIFICATION ******

    function handleQuantityButtonClick(event) {
        const button = event.target.closest('.quantity-btn');
        if (!button) return;
        const productId = parseInt(button.dataset.productId);
        const action = button.dataset.action;
        const product = products.find(p => p.id === productId);
        if (!product) return;
        let currentQuantity = currentOrder[productId] || 0;
        if (action === 'increment') {
            if (currentQuantity < product.stock) currentQuantity++;
            else alert(`Cannot order more than available stock (${product.stock}) for ${product.name}.`);
        } else if (action === 'decrement') {
            if (currentQuantity > 0) currentQuantity--;
        }
        if (currentQuantity > 0) currentOrder[productId] = currentQuantity;
        else delete currentOrder[productId];
        updateProductQuantityUI(productId);
        updateCurrentOrderDisplay();
    }

    function updateProductQuantityUI(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const quantityDisplay = document.getElementById(`qty-display-${productId}`);
        const minusButton = productTableBody.querySelector(`.minus-btn[data-product-id="${productId}"]`);
        const plusButton = productTableBody.querySelector(`.plus-btn[data-product-id="${productId}"]`);
        const currentQuantity = currentOrder[productId] || 0;
        if (quantityDisplay) quantityDisplay.textContent = currentQuantity;
        if (minusButton) minusButton.disabled = currentQuantity === 0;
        if (plusButton) plusButton.disabled = currentQuantity >= product.stock;
    }

    function updateCurrentOrderDisplay() {
        if (!currentOrderItemsDiv || !currentOrderTotalSpan || !placeOrderBtn) return;
        currentOrderItemsDiv.innerHTML = '';
        let totalAmount = 0, hasItems = false;
        for (const productId in currentOrder) {
            if (currentOrder.hasOwnProperty(productId)) {
                const quantity = currentOrder[productId];
                if (quantity > 0) {
                    hasItems = true;
                    const product = products.find(p => p.id === parseInt(productId));
                    if (!product) continue;
                    const itemTotal = product.price * quantity;
                    totalAmount += itemTotal;
                    const itemP = document.createElement('p');
                    itemP.textContent = `${product.name} x ${quantity} = ₹${itemTotal.toFixed(2)}`;
                    currentOrderItemsDiv.appendChild(itemP);
                }
            }
        }
        if (!hasItems) currentOrderItemsDiv.innerHTML = '<p>No items in order yet.</p>';
        currentOrderTotalSpan.textContent = `₹${totalAmount.toFixed(2)}`;
        placeOrderBtn.disabled = !hasItems;
    }

    function generateOrderCode() {
        const nextOrderNumber = orderHistory.length + 1;
        return String(nextOrderNumber).padStart(3, '0');
    }

    function handlePlaceOrder() {
        if (Object.keys(currentOrder).length === 0) {
            alert("Your order is empty. Please add items."); return;
        }
        if (!customerNameInput) return;
        
        const orderCode = generateOrderCode();
        
        const customerName = customerNameInput.value.trim() || "N/A";
        const orderItems = [];
        let orderTotal = 0, stockIssue = false;
        for (const productIdStr in currentOrder) {
            const productId = parseInt(productIdStr), quantity = currentOrder[productId];
            const productIndex = products.findIndex(p => p.id === productId);
            if (productIndex !== -1 && quantity > 0) {
                const product = products[productIndex];
                if (quantity > product.stock) {
                    alert(`Critical Stock Error: Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${quantity}. Order cannot be placed.`);
                    stockIssue = true; break;
                }
                products[productIndex].stock -= quantity;
                orderItems.push({
                    productId: product.id, name: product.name, quantity: quantity,
                    price: product.price, itemTotal: product.price * quantity
                });
                orderTotal += product.price * quantity;
            }
        }
        if (stockIssue) {
            renderProducts(); updateCurrentOrderDisplay(); handleStockProductSelectChange(); return;
        }
        const newOrder = {
            code: orderCode, customerName: customerName, items: orderItems,
            totalAmount: orderTotal, timestamp: new Date().toLocaleString(),
            preparationStatus: "Pending", paymentStatus: "Unpaid"
        };
        orderHistory.unshift(newOrder);
        currentOrder = {}; customerNameInput.value = '';
        renderProducts(); updateCurrentOrderDisplay(); renderOrderHistory(); handleStockProductSelectChange();
        alert(`Order #${orderCode} placed successfully! Total: ₹${orderTotal.toFixed(2)}`);
    }

    function renderOrderHistory() {
        if (!orderLogDiv) return;
        orderLogDiv.innerHTML = '';
        if (orderHistory.length === 0) {
            orderLogDiv.innerHTML = '<p>No orders placed yet.</p>'; return;
        }
        orderHistory.forEach(order => {
            const orderDiv = document.createElement('div');
            orderDiv.classList.add('order-log-item');
            let itemsHtml = '<ul>';
            order.items.forEach(item => {
                itemsHtml += `<li>${item.name} x ${item.quantity} @ ₹${item.price.toFixed(2)} (Subtotal: ₹${item.itemTotal.toFixed(2)})</li>`;
            });
            itemsHtml += '</ul>';

            orderDiv.innerHTML = `
                <p><strong>Order Code: ${order.code}</strong></p>
                <p>Customer: ${order.customerName}</p>
                <p>Date: ${order.timestamp}</p>
                <p>Items:</p>
                ${itemsHtml}
                <p>
                    <label>Preparation Status:</label>
                    <select class="status-select preparation-status-select" data-order-code="${order.code}" data-status-type="preparation">
                        <option value="Pending" ${order.preparationStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Preparing" ${order.preparationStatus === 'Preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="Ready" ${order.preparationStatus === 'Ready' ? 'selected' : ''}>Ready for Pickup/Delivery</option>
                        <option value="Completed" ${order.preparationStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </p>
                <p>
                    <label>Payment Status:</label>
                    <select class="status-select payment-status-select" data-order-code="${order.code}" data-status-type="payment">
                        <option value="Unpaid" ${order.paymentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                        <option value="Paid" ${order.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
                        <option value="Refunded" ${order.paymentStatus === 'Refunded' ? 'selected' : ''}>Refunded</option>
                    </select>
                </p>
                <p><strong>Total Paid: ₹${order.totalAmount.toFixed(2)}</strong></p>
                <button class="delete-order-btn" data-order-code="${order.code}">Delete Order</button>
            `;
            orderLogDiv.appendChild(orderDiv);
        });
    }

    function handleOrderStatusChange(event) {
        const targetSelect = event.target;
        if (targetSelect.classList.contains('status-select')) {
            const orderCode = targetSelect.dataset.orderCode;
            const statusType = targetSelect.dataset.statusType;
            const newStatus = targetSelect.value;
            const orderIndex = orderHistory.findIndex(o => o.code === orderCode);
            if (orderIndex !== -1) {
                if (statusType === 'preparation') orderHistory[orderIndex].preparationStatus = newStatus;
                else if (statusType === 'payment') orderHistory[orderIndex].paymentStatus = newStatus;
                console.log(`Order ${orderCode} ${statusType} status updated to ${newStatus}.`);
            } else {
                console.error("Order not found for status update:", orderCode);
            }
        }
    }

    function handleDeleteOrderClick(event) {
        const targetButton = event.target;
        if (targetButton.classList.contains('delete-order-btn')) {
            const orderCode = targetButton.dataset.orderCode;
            
            if (window.confirm(`Are you sure you want to delete Order #${orderCode}? Stock for its items will be restored.`)) {
                const orderIndex = orderHistory.findIndex(o => o.code === orderCode);
                if (orderIndex !== -1) {
                    const orderToDelete = orderHistory[orderIndex];

                    orderToDelete.items.forEach(item => {
                        const productIndex = products.findIndex(p => p.id === item.productId);
                        if (productIndex !== -1) {
                            products[productIndex].stock += item.quantity;
                        }
                    });

                    orderHistory.splice(orderIndex, 1);

                    renderOrderHistory();
                    renderProducts(); 
                    handleStockProductSelectChange(); 

                    alert(`Order #${orderCode} has been deleted and stock restored.`);
                } else {
                    alert(`Error: Could not find Order #${orderCode} to delete.`);
                }
            }
        }
    }

    function populateStockManagementDropdown() {
        if (!stockProductSelect) return;
        stockProductSelect.innerHTML = '';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (ID: ${product.id})`;
            stockProductSelect.appendChild(option);
        });
    }

    function handleStockProductSelectChange() {
        if (!stockProductSelect || !currentStockDisplay || !newStockInput) return;
        const selectedProductId = parseInt(stockProductSelect.value);
        if (isNaN(selectedProductId)) {
            currentStockDisplay.textContent = "-"; newStockInput.value = "";
            newStockInput.placeholder = "Select an item"; return;
        }
        const selectedProduct = products.find(p => p.id === selectedProductId);
        if (selectedProduct) {
            currentStockDisplay.textContent = selectedProduct.stock;
            newStockInput.value = ""; newStockInput.placeholder = `Current: ${selectedProduct.stock}`;
        } else {
            currentStockDisplay.textContent = "N/A"; newStockInput.value = "";
            newStockInput.placeholder = "Item not found";
        }
    }

    function handleUpdateStock() {
        if (!stockProductSelect || !newStockInput || !stockUpdateMsg) return;
        const selectedProductId = parseInt(stockProductSelect.value);
        const newStockValueStr = newStockInput.value.trim();
        if (isNaN(selectedProductId)) { alert("Please select an item."); return; }
        if (newStockValueStr === "") { alert("Please enter a new stock quantity."); return; }
        const newStockValue = parseInt(newStockValueStr);
        if (isNaN(newStockValue) || newStockValue < 0) {
            alert("Please enter a valid non-negative number for stock."); return;
        }
        const productIndex = products.findIndex(p => p.id === selectedProductId);
        if (productIndex !== -1) {
            products[productIndex].stock = newStockValue;
            renderProducts(); handleStockProductSelectChange();
            for (const pid in currentOrder) {
                if (currentOrder.hasOwnProperty(pid)) {
                    const p = products.find(prod => prod.id === parseInt(pid));
                    if (p && currentOrder[pid] > p.stock) {
                        alert(`Warning: Item "${p.name}" in current order (${currentOrder[pid]}) now exceeds new stock (${p.stock}). Please adjust order.`);
                    }
                }
            }
            updateCurrentOrderDisplay();
            stockUpdateMsg.textContent = `Stock for "${products[productIndex].name}" updated to ${newStockValue}.`;
            stockUpdateMsg.style.display = 'block';
            setTimeout(() => { stockUpdateMsg.style.display = 'none'; }, 4000);
            newStockInput.value = "";
        } else {
            alert("Error: Selected item not found for stock update.");
        }
    }

    if (lockScreenDiv && lockScreenDiv.style.display !== 'none' && accessCodeInput) {
        accessCodeInput.focus();
    }
});