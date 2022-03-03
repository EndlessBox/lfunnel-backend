var express = require("express");
var app = express();
var morgan = require("morgan");
var cors = require("cors");
var axios = require("axios");

const config = require("./config.json");
const db = require("./models");
const UserInfo = db.userInfos;

app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());

// Sequelize Sync.
db.sequelize
  .sync()
  .then(() => {
    console.log("Drop and re-sync db");
  })
  .catch((err) => console.log(err));

// Route that get user infor to claim an lightfunnels authentication key.
app.post("/lfauth", async (req, res) => {
  try {
    /*
     * use the code provided bu authfunnels to get authentication Token.
     */
    var payload = {
      code: req.body.code,
      client_id: req.body["client-id"],
      client_secret: req.body.state,
    };

    var resp = await axios.post(config.lightFunnelAccessURL, payload);

    /*
     *  Save to the database
     */
    const userInfo = {
      accessToken: resp.data.access_token,
      accountId: resp.data.account_id,
      KlavPrivateKey: null,
      KlavPrivateKey: null,
    };
    await UserInfo.create(userInfo);

    /*
     *  Create a webhook to listen to order event from light funnel.
     */
    const hookResp = await axios({
      url: config.lightFunnelHooksURL,
      method: "post",
      data: {
        query: `mutation CreateWebhook($node: WebhookInput!) {
            createWebhook(node: $node
              ){
              _id
            }
          }`,
        variables: {
          node: {
            type: "order/created",
            url: `${config.ngrokURL}orderCreated?accountId=${userInfo.accountId}`,
            settings: {},
          },
        },
      },
      headers: {
        Authorization: `Bearer ${userInfo.accessToken}`,
      },
    });
    console.log("webHook create id : " + hookResp.data.data.createWebhook._id);
    res.status(200).json({ created: true });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

/*
 *  Route to retrieve Klaviyo Public/Private Key and
 *  store them in the database.
 */
app.post("/klaviyoKeys", async (req, res) => {
  try {
    if (!req.body.accountID)
      return res.status(400).send("please provide account Id");
    let query = {
      klavPublicKey: req.body.publicKey ? req.body.publicKey : null,
      klavPrivateKey: req.body.privateKey ? req.body.privateKey : null,
    };

    await UserInfo.update(query, {
      where: { accountId: req.body.accountID },
    });

    res.status(200).json({ success: "keys retrieved succefully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

/*
 * Hook to listen to order creation, then sync them to klaviyo.
 */
app.post("/orderCreated", async (req, res) => {
  try {
    var userInfosResp = await UserInfo.findOne(
      {
        attributes: ["klavPublicKey"],
      },
      {
        where: { accountId: req.query.accountId },
      }
    );

    var klavRequest = {
      token: userInfosResp.dataValues.klavPublicKey,
      event: "Placed Order",
      customer_properties: {
        $email: req.body.email,
        $first_name: req.body.customer.first_name,
        $last_name: req.body.customer.last_name,
        $phone_number: req.body.phone,
      },
      properties: {
        $event_id: req.body.id,
        $value: req.body.sub_total,
        $orderId: req.body.id,
        Items: req.body.items,
        BillingAddress: {
          FirstName: req.body.billing_address_name,
          LastName: req.body.billing_address_name,
          Address1: req.body.billing_address_line1,
          address2: req.body.billing_address_line2,
          City: req.body.billing_address_city,
          Region: req.body.billing_address_state,
          Country: req.body.billing_address_country,
          Zip: req.body.billing_address_zip,
          Phone: req.body.phone,
        },
        ShippingAddress: {
          FirstName: req.body.shipping_address_name,
          LastName: req.body.shipping_address_name,
          Address1: req.body.shipping_address_line1,
          Address2: req.body.shipping_address_line2,
          City: req.body.shipping_address_city,
          Region: req.body.shipping_address_state,
          Country: req.body.shipping_address_country,
          Zip: req.body.shipping_address_zip,
          Phone: req.body.phone,
        },
      },
      time: parseInt(new Date().getTime() / 1000),
    };

    await axios.post("https://a.klaviyo.com/api/track", klavRequest);
    res.status(200).send("got it");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(4000, () => {
  console.log("server listening on port " + 4000);
});
