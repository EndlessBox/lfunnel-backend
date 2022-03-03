var express = require("express");
var app = express();
var morgan = require("morgan");
var cors = require("cors");
var axios = require("axios");
const db = require("./models");
const UserInfo = db.userInfos;

app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());

// Sequelize Sync.
db.sequelize
  // .sync({ force: true })
  .sync()
  .then(() => {
    console.log("Drop and re-sync db");
  })
  .catch((err) => console.log(err));

// Route that get user infor to claim an lightfunnels authentication key.
app.post("/lfauth", (req, res) => {
  res.status(200).json({ created: true });

  var payload = {
    code: req.body.code,
    client_id: req.body["client-id"],
    client_secret: req.body.state,
  };

  axios
    .post("https://api.lightfunnels.com/oauth/access", payload)
    .then(async (resp) => {
      try {
        const userInfo = {
          accessToken: resp.data.access_token,
          accountId: resp.data.account_id,
          KlavPrivateKey: null,
          KlavPrivateKey: null,
        };
        await UserInfo.create(userInfo);
        const hookResp = await axios({
          url: "https://api.lightfunnels.com/graphql",
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
                url: `http://f42b-196-117-17-120.ngrok.io/orderCreated?accountId=${userInfo.accountId}`,
                settings: {},
              },
            },
          },
          headers: {
            Authorization: `Bearer ${userInfo.accessToken}`,
          },
        });
        console.log(
          "webHook create id : " + hookResp.data.data.createWebhook._id
        );
      } catch (err) {
        console.error(err);
      }
    })
    .catch((err) => console.log(err.message));
});

app.post("/klaviyoKeys", async (req, res) => {
  try {
    console.log(req.body);
    if (!req.body.accountID)
      return res.status(400).send("please provide account Id");
    let query = {
      klavPublicKey: req.body.publicKey ? req.body.publicKey : null,
      klavPrivateKey: req.body.privateKey ? req.body.privateKey : null,
    };

    let updateResp = await UserInfo.update(query, {
      where: { accountId: req.body.accountID },
    });
    console.log(updateResp);
    res.status(200).json({ success: "keys retrieved succefully" });
  } catch (err) {
    console.error(err);
  }
});

// Hoooooks
app.post("/orderCreated", async (req, res) => {
  var randomOrderId = Math.floor(Math.random() * 1 * 99999);

  var userInfosResp = await UserInfo.findOne(
    {
      attributes: ["klavPublicKey"],
    },
    {
      where: { accountId: req.query.accountId },
    }
  );
  console.log(userInfosResp.dataValues.klavPublicKey);

  console.log(req.body);

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

  var klavResponse = await axios.post(
    "https://a.klaviyo.com/api/track",
    klavRequest
  );
  res.status(200).send("got it");
});

// app.post("/contactFormCreated", (req, res) => {
//   console.log(req.body);
//   res.status(200).send("got it");
// });

app.listen(4000, () => {
  console.log("server listening on port " + 4000);
});
