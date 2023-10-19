const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
//middlewere
app.use(cors());
app.use(express.json());
// mongo db

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ocircleo.zgezjlp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized acces" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCES_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(403)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //   await client.connect();
    const musicShop = client.db("courses");
    const users = musicShop.collection("users");
    const classes = musicShop.collection("classes");

    app.get("/", (req, res) => {
      res.send(`the server is runnigng beta`);
    });
    //sends api key to user
    app.post("/secreate", (req, res) => {
      let user = req.body;
      const token = jwt.sign(user, process.env.ACCES_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    //Gets all the users
    app.get("/users", async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });
    //Gets one user detaill
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await users.findOne(query);
      res.send(result);
    });
    // Gets all the instractors
    app.get("/isntractor", async (req, res) => {
      const query = { role: "isntaractor" };
      const result = await users.find(query).toArray();
      res.send(result);
    });
    //Gets limited number of intractors
    app.get("/isntractorlimited", async (req, res) => {
      const query = { role: "isntaractor" };
      const result = await users.find(query).limit(3).toArray();
      res.send(result);
    });
    //Gets single classes
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classes.findOne(query);
      if (result == null) {
        res.send({ avialable: false });
      } else {
        res.send(result);
      }
    });

    // Gets all the classes
    app.get("/classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classes.find(query).toArray();
      res.send(result);
    });
    //Gets limited number of classes
    app.get("/classeslimited", async (req, res) => {
      const query = { status: "approved" };
      const result = await classes.find(query).limit(6).toArray();
      res.send(result);
    });
    //Gets all calsses for Instractor
    app.get("/istractorclass/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await classes.find(query).toArray();
      res.send(result);
    });
    // Gets pending classes for admin
    app.get("/pendingclasses", async (req, res) => {
      const query = { status: "pending" };
      const result = await classes.find(query).toArray();
      res.send(result);
    });
    //Gets users cart
    // Add new users
    app.post("/addusers", async (req, res) => {
      const userData = req.body;
      req.body.role = null;
      const query = { email: req.body.email };
      const secure = await users.findOne(query);
      if (!secure) {
        const result = await users.insertOne(userData);
        res.send(result);
      } else {
        res.send({ status: "user already exits" });
      }
    });
    //Adds new classes
    app.post("/addclass", verifyJwt, async (req, res) => {
      const newClass = req.body;
      newClass.status = "pending";
      const result = await classes.insertOne(newClass);
      res.send(result);
    });
    // Empowers an user to admin or instractor
    app.patch("/empoweruser", verifyJwt, async (req, res) => {
      const email = req.body.email;
      const newrole = req.body.role;
      const query = { email: email };
      const option = { upsert: false };
      const updateuser = {
        $set: {
          role: newrole,
        },
      };
      const result = await users.updateOne(query, updateuser, option);
      res.send(result);
    });
    //Approve Class
    app.patch("/approveclass/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const option = { upsert: false };
      const approveClass = {
        $set: {
          status: "approved",
        },
      };
      const result = await classes.updateOne(query, approveClass, option);
      res.send(result);
    });
    app.patch("/addmyclasses", verifyJwt, async (req, res) => {
      const data = req.body;
      const id = data.id;
      const email = data.email;
      const emailQuery = { email: email };
      const findUser = await users.findOne(emailQuery);
      const findUserCart = findUser?.cart || [];
      const option = { upsert: true };
      const newCart = {
        $set: {
          cart: [...findUserCart, id],
        },
      };
      const result = await users.updateOne(emailQuery, newCart, option);
      res.send(result);
    });
    //Deletes a cart element
    app.patch("/deletethis", verifyJwt, async (req, res) => {
      const id = req.body.id,
        email = req.body.email,
        query = { email: email },
        result = await users.updateOne(query, {
          $pull: { cart: { $in: [id] } },
        });
      res.send(result);
    });
    app.delete("/deletesimglecourse/:id", verifyJwt, async (req, res) => {
      let id = req.params.id;
      let query = { _id: new ObjectId(id) };
      const result = await classes.deleteOne(query);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`app is running at port ${port}`);
});
