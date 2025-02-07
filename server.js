import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

app.get("/order-tracking", async (req, res) => {
    const { order, email } = req.query;
  
    if (!order || !email) {
      return res.status(400).json({ success: false, message: "Missing order or email" });
    }
  
    try {
      const customerResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2023-10/customers/search.json?query=email:${encodeURIComponent(email)}`, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      });

      const customerData = await customerResponse.json();

      if (!customerData.customers || customerData.customers.length === 0) {
        return res.status(404).json({ success: false, message: "No account found with this email" });
      }

      const customerId = customerData.customers[0].id;

      const ordersResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2023-10/orders.json?customer_id=${customerId}`, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      });

      const ordersData = await ordersResponse.json();

      if (!ordersData.orders || ordersData.orders.length === 0) {
        return res.status(404).json({ success: false, message: "No orders found for this email" });
      }

      // **Step 3:** Find the matching order
      const matchingOrder = ordersData.orders.find(o => o.order_number == order);

      if (matchingOrder) {

        const fulfillment = matchingOrder.fulfillments[0] || {};

        // **Check if tracking number is available**
        const trackingNumber = fulfillment.tracking_number || "No tracking number available";
        const carrier = fulfillment.tracking_company || "No carrier available";
        const trackingURL = fulfillment.tracking_url || matchingOrder.order_status_url || "#";
        const status = matchingOrder.fulfillment_status || "Unfulfilled";

        return res.json({
          success: true,
          order_number: matchingOrder.name,
          tracking_number: trackingNumber,
          carrier: carrier,
          status: status,
          tracking_url: trackingURL,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "No order found with this number for the provided email.",
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
