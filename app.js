const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Pool } = require('pg');
const connectPgSession = require('connect-pg-simple')(session);
const config = require('./config.json');
const { Client, ChannelType, GatewayIntentBits } = require('discord.js');
const bodyParser = require('body-parser');
const axios = require('axios');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const app = express();
app.use(bodyParser.json());


app.post('/guild/:guildId/:menu', async (req, res) => {
  const { channel, clan, logo, template } = req.body;
  const guildId = req.params.guildId;
  const menu = req.params.menu;

  console.log('Channel:', channel);
  console.log('Clan:', clan);
  console.log('Logo:', logo);
  console.log('Template:', template);

  const isChannelValid = await checkChannelExists(guildId, channel);
  const isClanValid = await checkClanTag(clan);


  res.json({ channelValid: isChannelValid, clanValid: isClanValid });
});




const databasePool = new Pool({
  connectionString: config.pgURI
});

async function initializeSessionTable() {
  const client = await databasePool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_session" (
        "sid" VARCHAR NOT NULL PRIMARY KEY,
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "IDX_user_session_expires_at" ON "user_session" ("expire");
    `);
    console.log("User session table is ready.");
  } catch (error) {
    console.error("Error creating user session table:", error);
  } finally {
    client.release();
  }
}

passport.serializeUser((userProfile, done) => {
  done(null, userProfile);
});

passport.deserializeUser((storedUserData, done) => {
  done(null, storedUserData);
});

const fetchLatestUserData = async (accessToken) => {
  try {
    const { default: fetch } = await import('node-fetch');

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user data from Discord');
    }
    const userData = await userResponse.json();

    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!guildsResponse.ok) {
      throw new Error('Failed to fetch guilds data from Discord');
    }

    const guildsData = await guildsResponse.json();

    const latestUserData = {
      ...userData,
      guilds: guildsData
    };

    return latestUserData;
  } catch (error) {
    console.error('Error fetching latest user data:', error);
    throw error;
  }
};

passport.use(new DiscordStrategy({
  clientID: config.clientID,
  clientSecret: config.clientSecret,
  callbackURL: config.callbackURL,
  scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, discordProfile, done) => {
  try {
    const latestUserData = await fetchLatestUserData(accessToken);
    latestUserData.accessToken = accessToken;
    latestUserData.lastUpdated = Date.now();
    return done(null, latestUserData);
  } catch (error) {
    return done(error);
  }
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.use(session({
  store: new connectPgSession({
    pool: databasePool,
    tableName: 'user_session'
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 100 * 365 * 24 * 60 * 60 * 1000 } //100 years
}));

app.use(passport.initialize());
app.use(passport.session());

const updateUserMiddleware = async (req, res, next) => {
  if (req.isAuthenticated()) {
    try {
      const latestUserData = await fetchLatestUserData(req.user.accessToken);
      req.user = { ...latestUserData, accessToken: req.user.accessToken };
      req.session.passport.user = req.user;
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  }
  next();
};

app.get('/', updateUserMiddleware, (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/about', updateUserMiddleware, (req, res) => {
  res.render('about', { user: req.user });
});

app.get('/commands', updateUserMiddleware, (req, res) => {
  res.render('commands', { user: req.user });
});

app.get('/support', updateUserMiddleware, (req, res) => {
  res.render('support', { user: req.user });
});

const getGuildById = (guildId, userGuilds) => {
  return userGuilds.find(guild => guild.id === guildId);
};

app.get('/guild/:guildId', (req, res) => {
  const guildId = req.params.guildId;
  const oneguild = getGuildById(guildId, req.user.guilds);

  if (oneguild) {

    // Render the guild page with guild data
    res.render('guild', {
      guild: oneguild,
      user: req.user,
      menu: ""
    });
  } else {
    // If guild not found, handle the error
    res.status(404).send('Guild not found');
  }
});

app.get('/guild/:guildId/:menu', (req, res) => {
  const guildId = req.params.guildId;
  const oneguild = getGuildById(guildId, req.user.guilds);
  const menu = req.params.menu;
  if (oneguild) {
    if (menu === "info" || menu === "history" || menu === "members") {
      // Render the guild page with guild data
      res.render('guild', {
        guild: oneguild,
        user: req.user,
        menu: menu
      });
    }
    else {
      // If guild not found, handle the error
      res.status(404).send('Wrong Menu');
    }

  } else {
    // If guild not found, handle the error
    res.status(404).send('Guild not found');
  }
});

app.get('/serve', (req, res) => {res.render('serve')});


app.get('/login', passport.authenticate('discord'));

app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });
});

app.listen(config.port, () => {
  initializeSessionTable();
  console.log(`Server is running on http://localhost:${config.port}`);
});



//functions

async function checkChannelExists(guildId, channelId) {
  const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bot ${config.token}`
    }
  });
  const channels = await response.json();
  return channels.some(channel => channel.id === channelId);
}

async function checkClanTag(clanTag) {
  const encodedClanTag = encodeURIComponent(clanTag.startsWith('#') ? clanTag : `#${clanTag}`);
  const url = `https://api.clashofclans.com/v1/clans/${encodedClanTag}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${config.cocToken}`
      },
      validateStatus: false
    });
    console.log(response.data);
    if (response.status === 200) {
      return true; // Clan found
    } else if (response.status === 404) {
      console.error('Clan not found:', response.data.reason);
      return false; // Clan not found
    } else {
      console.error('Error fetching clan data:', response.status, response.data);
      return false; // Some other error occurred
    }
  } catch (err) {
    console.error('Failed to get clan:', err.response ? err.response.data : err.message);
    return false;
  }
}



client.login(config.token);