// Protect dashboard page
protectPage();

// Logout handler
document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    authAPI.logout();
});

// Load dashboard data
async function loadDashboard() {
    try {
        const [profile, dashboard] = await Promise.all([
            authAPI.getProfile(),
            affiliateAPI.getDashboard(30),
        ]);

        // Update welcome message
        const welcomeMsg = document.getElementById('welcome-message');
        if (profile.firstName) {
            welcomeMsg.textContent = `Welcome back, ${profile.firstName}!`;
        }

        // Update click stats
        document.getElementById('total-clicks').textContent =
            dashboard.clicks.totalClicks.toLocaleString();
        document.getElementById('conversions').textContent =
            dashboard.clicks.conversions.toLocaleString();
        document.getElementById('conversion-rate').textContent =
            `${dashboard.clicks.conversionRate}%`;

        // Update commission stats
        document.getElementById('pending-earnings').textContent =
            formatCurrency(dashboard.commissions.pending.amount);
        document.getElementById('pending-count').textContent =
            `${dashboard.commissions.pending.count} commissions`;

        document.getElementById('approved-earnings').textContent =
            formatCurrency(dashboard.commissions.approved.amount);
        document.getElementById('approved-count').textContent =
            `${dashboard.commissions.approved.count} commissions`;

        document.getElementById('paid-earnings').textContent =
            formatCurrency(dashboard.commissions.paid.amount);
        document.getElementById('paid-count').textContent =
            `${dashboard.commissions.paid.count} payouts`;

        // Update EPC
        document.getElementById('epc').textContent =
            formatCurrency(Math.round(dashboard.epc * 100));

        // Display recent activity
        displayRecentActivity(dashboard.recentActivity);

    } catch (error) {
        console.error('Failed to load dashboard:', error);
        alert('Failed to load dashboard data');
    }
}

function displayRecentActivity(activity) {
    const activityDiv = document.getElementById('recent-activity');

    if (!activity.recentOrders.length && !activity.recentCommissions.length) {
        activityDiv.innerHTML = '<p>No recent activity</p>';
        return;
    }

    let html = '<table class="table"><thead><tr><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>';

    // Add recent orders
    activity.recentOrders.forEach(order => {
        html += `
            <tr>
                <td>Order</td>
                <td>${formatDate(order.orderDate)}</td>
                <td>${formatCurrency(order.totalAmount, order.currency)}</td>
                <td><span class="badge badge-success">${order.status}</span></td>
            </tr>
        `;
    });

    // Add recent commissions
    activity.recentCommissions.forEach(commission => {
        const badgeClass = commission.status === 'PAID' ? 'badge-success' :
                          commission.status === 'APPROVED' ? 'badge-info' : 'badge-warning';
        html += `
            <tr>
                <td>Commission</td>
                <td>${formatDate(commission.createdAt)}</td>
                <td>${formatCurrency(commission.commissionAmount, commission.currency)}</td>
                <td><span class="badge ${badgeClass}">${commission.status}</span></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    activityDiv.innerHTML = html;
}

// Load dashboard on page load
loadDashboard();
