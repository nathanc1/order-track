import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors"; 


dotenv.config();

const app = express();

// Allow cross-origin requests from anywhere, for when we change domain

app.use(cors());


const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const GQL_QUERY = `
  query getCustomerOrders($emailQuery: String!, $first: Int!) {
    customers(query: $emailQuery, first: 1) {
      edges {
        node {
          id
          orders(first: $first) {
            edges {
              node {
                name
                orderNumber
                fulfillmentStatus
                orderStatusUrl
                fulfillments {
                  trackingNumber
                  trackingCompany
                  trackingUrl
                }
              }
            }
          }
        }
      }
    }
  }
`;

app.get("/order-tracking", async (req, res) => {
  const { order, email } = req.query;

  if (!order || !email) {
    return res.status(400).json({ success: false, message: "Missing order or email" });
  }

  try {
    const variables = {
      emailQuery: `email:${email}`,
      first: 50
    };

    const graphQLResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN
      },
      body: JSON.stringify({
        query: GQL_QUERY,
        variables
      })
    });

    const graphData = await graphQLResponse.json();

    if (graphData.errors) {
      console.error("Shopify GraphQL Errors:", graphData.errors);
      return res.status(500).json({ success: false, message: "Shopify GraphQL error", error: graphData.errors });
    }

    const customersEdges = graphData.data?.customers?.edges || [];
    if (customersEdges.length === 0) {
      return res.status(404).json({ success: false, message: "No account found with this email" });
    }

    const customerNode = customersEdges[0].node;
    const ordersEdges = customerNode.orders.edges || [];
    if (ordersEdges.length === 0) {
      return res.status(404).json({ success: false, message: "No orders found for this email" });
    }

  
    const matchingOrderNode = ordersEdges.find(
      (o) => o.node.orderNumber == parseInt(order, 10)  
    )?.node;

    if (!matchingOrderNode) {
      return res.status(404).json({
        success: false,
        message: "No order found with this number for the provided email."
      });
    }

    const fulfillment = matchingOrderNode.fulfillments[0] || {};
    const trackingNumber = fulfillment.trackingNumber || "No tracking number available";
    const carrier = fulfillment.trackingCompany || "No carrier available";
    const trackingUrl = fulfillment.trackingUrl || matchingOrderNode.orderStatusUrl || "#";
    const status = matchingOrderNode.fulfillmentStatus || "Unfulfilled";

    return res.json({
      success: true,
      order_number: matchingOrderNode.name,  
      tracking_number: trackingNumber,
      carrier: carrier,
      status: status,
      tracking_url: trackingUrl
    });

  } catch (error) {
    console.error("🚨 Error fetching order via GraphQL:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});