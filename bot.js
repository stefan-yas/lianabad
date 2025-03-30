require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const snoowrap = require("snoowrap");

// Load environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT;
const REDDIT_REFRESH_TOKEN = process.env.REDDIT_REFRESH_TOKEN;

// Initialize Telegram Bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize Reddit API Client
const reddit = new snoowrap({
  clientId: REDDIT_CLIENT_ID,
  clientSecret: REDDIT_CLIENT_SECRET,
  refreshToken: REDDIT_REFRESH_TOKEN,
  userAgent: REDDIT_USER_AGENT,
});

// Store user subreddit preferences and pagination state
const userPreferences = {};
// Store scheduled updates
const scheduledUpdates = {};
// Default post limit per page
const DEFAULT_POST_LIMIT = 5;

// Set up bot commands menu
async function setupBotCommands() {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Start the bot and set a subreddit' },
      { command: 'help', description: 'Display help information' },
      { command: 'change', description: 'Change your subreddit' },
      { command: 'settings', description: 'Configure your preferences' },
      { command: 'schedule', description: 'Set up daily subreddit updates' },
      { command: 'viewschedule', description: 'View your scheduled updates' },
      { command: 'cancelschedule', description: 'Cancel scheduled updates' },
      { command: 'nsfw', description: 'Toggle NSFW filter (default: filtered)' },
      { command: 'menu', description: 'Show all available commands' }
    ]);
    console.log("Bot commands menu set up successfully!");
  } catch (error) {
    console.error("Error setting up bot commands menu:", error);
  }
}

// Test Reddit connection on startup
async function testRedditConnection() {
  try {
    const testSub = await reddit.getSubreddit("AskReddit").fetch();
    console.log("Reddit API connection successful!");
    return true;
  } catch (error) {
    console.error("Reddit API connection error:", error);
    return false;
  }
}

// Menu command - shows all available commands with descriptions
bot.onText(/\/menu/, (msg) => {
  const menuMessage = `
📱 *Reddit Telegram Bot Menu* 📱

*Available Commands:*
/start - Start the bot and set a subreddit
/help - Display detailed help information
/change - Change your subreddit
/settings - Configure your preferences
/schedule - Set up daily updates from your subreddit
/viewschedule - View your scheduled updates
/cancelschedule - Cancel scheduled updates
/nsfw - Toggle NSFW filter (default: filtered)
/menu - Show this menu

You can also just send any subreddit name (with or without "r/") to check it!
`;

  bot.sendMessage(msg.chat.id, menuMessage, { 
    parse_mode: "Markdown",
    reply_markup: {
      keyboard: [
        [{ text: "/start" }, { text: "/help" }, { text: "/change" }],
        [{ text: "/settings" }, { text: "/schedule" }, { text: "/nsfw" }],
        [{ text: "/viewschedule" }, { text: "/cancelschedule" }]
      ],
      resize_keyboard: true
    }
  });
});

// Help command
bot.onText(/\/help/, (msg) => {
  const helpMessage = `
📱 *Reddit Telegram Bot Help* 📱

*Commands:*
/start - Start the bot and set a subreddit
/change - Change your subreddit
/help - Display this help message
/settings - Configure your preferences
/schedule - Set up daily updates from your subreddit
/viewschedule - View your scheduled updates
/cancelschedule - Cancel scheduled updates
/nsfw - Toggle NSFW filter (default: filtered)
/menu - Show all available commands

*Navigation:*
Use the buttons below posts to navigate between pages.

*Feed Types:*
🔥 Hot - Currently popular posts
🆕 New - Most recent posts
🏆 Top - Highest rated posts of all time

*Tip:* Send any subreddit name (with or without "r/") to check it.
`;

  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: "Markdown" });
});

// Start command
bot.onText(/\/start/, (msg) => {
  // Initialize user preferences if not exist
  if (!userPreferences[msg.chat.id]) {
    userPreferences[msg.chat.id] = {
      filterNSFW: true,
      pagination: {
        currentPage: 0,
        limit: DEFAULT_POST_LIMIT
      }
    };
  }
  
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to the Reddit Telegram Bot!\n\nSend me a subreddit name to track (e.g., 'AskReddit' or 'r/AskReddit').\n\nType /help for more commands or /menu to see all available features.",
    {
      reply_markup: {
        keyboard: [
          [{ text: "/help" }, { text: "/menu" }],
          [{ text: "/change" }, { text: "/settings" }]
        ],
        resize_keyboard: true
      }
    }
  );
});

// Change subreddit command
bot.onText(/\/change/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Please send me the name of the new subreddit you want to track (e.g., 'AskReddit' or 'r/AskReddit')."
  );
});

// Settings command
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id;
  
  // Initialize user preferences if they don't exist
  if (!userPreferences[chatId]) {
    userPreferences[chatId] = {
      filterNSFW: true,
      pagination: {
        currentPage: 0,
        limit: DEFAULT_POST_LIMIT
      }
    };
  }
  
  const nsfwStatus = userPreferences[chatId].filterNSFW ? "Filtered" : "Allowed";
  const postsPerPage = userPreferences[chatId].pagination.limit;
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: `NSFW Content: ${nsfwStatus}`, callback_data: "toggle_nsfw" }],
        [{ text: "Posts Per Page: 3", callback_data: "posts_3" },
         { text: "Posts Per Page: 5", callback_data: "posts_5" },
         { text: "Posts Per Page: 10", callback_data: "posts_10" }]
      ]
    }
  };
  
  bot.sendMessage(
    chatId,
    `*Settings*\n\n• NSFW Content: ${nsfwStatus}\n• Posts Per Page: ${postsPerPage}`,
    { 
      parse_mode: "Markdown",
      reply_markup: options.reply_markup
    }
  );
});

// Toggle NSFW command
bot.onText(/\/nsfw/, (msg) => {
  const chatId = msg.chat.id;
  
  // Initialize user preferences if they don't exist
  if (!userPreferences[chatId]) {
    userPreferences[chatId] = {
      filterNSFW: true,
      pagination: {
        currentPage: 0,
        limit: DEFAULT_POST_LIMIT
      }
    };
  }
  
  // Toggle NSFW filter
  userPreferences[chatId].filterNSFW = !userPreferences[chatId].filterNSFW;
  const status = userPreferences[chatId].filterNSFW ? "filtered" : "allowed";
  
  bot.sendMessage(
    chatId,
    `NSFW content is now *${status}*.`,
    { parse_mode: "Markdown" }
  );
});

// Schedule command
bot.onText(/\/schedule/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!userPreferences[chatId] || !userPreferences[chatId].subreddit) {
    bot.sendMessage(
      chatId,
      "You need to set a subreddit first. Send me a subreddit name or use /change."
    );
    return;
  }
  
  const subreddit = userPreferences[chatId].subreddit;
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Daily at 9:00 AM", callback_data: `schedule_${subreddit}_9` }],
        [{ text: "Daily at 12:00 PM", callback_data: `schedule_${subreddit}_12` }],
        [{ text: "Daily at 6:00 PM", callback_data: `schedule_${subreddit}_18` }],
        [{ text: "Cancel", callback_data: "cancel_schedule" }]
      ]
    }
  };
  
  bot.sendMessage(
    chatId,
    `Set up daily updates from r/${subreddit}:`,
    options
  );
});

// View scheduled updates
bot.onText(/\/viewschedule/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!scheduledUpdates[chatId] || scheduledUpdates[chatId].length === 0) {
    bot.sendMessage(
      chatId,
      "You don't have any scheduled updates. Use /schedule to set one up."
    );
    return;
  }
  
  let message = "*Your Scheduled Updates:*\n\n";
  
  scheduledUpdates[chatId].forEach((update, index) => {
    message += `${index + 1}. r/${update.subreddit} - ${update.feedType} posts at ${update.hour}:00\n`;
  });
  
  bot.sendMessage(
    chatId,
    message,
    { parse_mode: "Markdown" }
  );
});

// Cancel scheduled updates
bot.onText(/\/cancelschedule/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!scheduledUpdates[chatId] || scheduledUpdates[chatId].length === 0) {
    bot.sendMessage(
      chatId,
      "You don't have any scheduled updates to cancel."
    );
    return;
  }
  
  let keyboard = [];
  
  scheduledUpdates[chatId].forEach((update, index) => {
    keyboard.push([{
      text: `${index + 1}. r/${update.subreddit} - ${update.hour}:00`,
      callback_data: `cancel_schedule_${index}`
    }]);
  });
  
  keyboard.push([{ text: "Cancel All", callback_data: "cancel_all_schedules" }]);
  
  const options = {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
  
  bot.sendMessage(
    chatId,
    "Select a scheduled update to cancel:",
    options
  );
});

// Handle subreddit name input
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text?.trim();
  
  // Skip if no text or it's a command
  if (!messageText || messageText.startsWith("/")) return;
  
  let subreddit = messageText;

  // Remove "r/" prefix if present
  if (subreddit.startsWith("r/")) {
    subreddit = subreddit.substring(2);
  }
  
  bot.sendMessage(chatId, `🔍 Checking subreddit r/${subreddit}...`);

  // Check if the subreddit exists before proceeding
  try {
    const subredditInfo = await reddit.getSubreddit(subreddit).fetch();
    
    // Verify we got actual data back
    if (!subredditInfo || !subredditInfo.display_name) {
      bot.sendMessage(chatId, `⚠️ Could not verify subreddit r/${subreddit}.`);
      return;
    }
    
    // Initialize user preferences if they don't exist
    if (!userPreferences[chatId]) {
      userPreferences[chatId] = {
        filterNSFW: true,
        pagination: {
          currentPage: 0,
          limit: DEFAULT_POST_LIMIT
        }
      };
    }
    
    // Store subreddit for the user and reset pagination
    userPreferences[chatId].subreddit = subreddit;
    userPreferences[chatId].pagination.currentPage = 0;
    
    // Check if subreddit is NSFW
    if (subredditInfo.over18 && userPreferences[chatId].filterNSFW) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Show NSFW Content", callback_data: `allow_nsfw_${subreddit}` }],
            [{ text: "Cancel", callback_data: "cancel_nsfw" }]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        `⚠️ Warning: r/${subreddit} is marked as NSFW. Your current settings filter NSFW content.`,
        options
      );
      return;
    }
    
    // Ask user to select a feed type
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 Hot", callback_data: `hot_${subreddit}` }],
          [{ text: "🆕 New", callback_data: `new_${subreddit}` }],
          [{ text: "🏆 Top", callback_data: `top_${subreddit}` }],
        ],
      },
    };
    
    bot.sendMessage(chatId, `Choose a feed type for r/${subreddit}:`, options);
    
  } catch (error) {
    console.error("Subreddit fetch error:", error);
    
    // Check the specific error for better user feedback
    if (error.message && error.message.includes("private")) {
      bot.sendMessage(chatId, `⚠️ Subreddit r/${subreddit} is private.`);
    } else if (error.message && error.message.includes("banned")) {
      bot.sendMessage(chatId, `⚠️ Subreddit r/${subreddit} is banned.`);
    } else if (error.statusCode === 404 || (error.message && error.message.includes("404"))) {
      bot.sendMessage(chatId, `⚠️ Subreddit r/${subreddit} does not exist.`);
    } else {
      bot.sendMessage(
        chatId, 
        `⚠️ Error connecting to Reddit API. Please try again later or check your API credentials.`
      );
    }
  }
});

// Handle callback queries
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  // Answer callback query to remove loading state
  bot.answerCallbackQuery(callbackQuery.id);
  
  // Handle different callback types
  if (data.startsWith("hot_") || data.startsWith("new_") || data.startsWith("top_")) {
    // Feed type selection
    const [feedType, subreddit] = data.split("_");
    
    // Save feed type in user preferences and reset pagination
    userPreferences[chatId].feedType = feedType;
    userPreferences[chatId].pagination.currentPage = 0;
    
    // Confirm selection and show loading message
    bot.sendMessage(chatId, `✅ Tracking r/${subreddit} (${feedType} feed). Fetching posts...`);
    
    // Fetch and send posts
    fetchAndSendPosts(chatId, subreddit, feedType);
  } 
  else if (data.startsWith("page_")) {
    // Pagination
    const [_, direction, subreddit, feedType] = data.split("_");
    
    if (direction === "next") {
      userPreferences[chatId].pagination.currentPage++;
    } else if (direction === "prev") {
      userPreferences[chatId].pagination.currentPage = Math.max(0, userPreferences[chatId].pagination.currentPage - 1);
    }
    
    fetchAndSendPosts(chatId, subreddit, feedType);
  }
  else if (data === "toggle_nsfw") {
    // Toggle NSFW filter
    userPreferences[chatId].filterNSFW = !userPreferences[chatId].filterNSFW;
    const status = userPreferences[chatId].filterNSFW ? "Filtered" : "Allowed";
    
    // Update settings message
    const options = {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: `NSFW Content: ${status}`, callback_data: "toggle_nsfw" }],
          [{ text: "Posts Per Page: 3", callback_data: "posts_3" },
           { text: "Posts Per Page: 5", callback_data: "posts_5" },
           { text: "Posts Per Page: 10", callback_data: "posts_10" }]
        ]
      }
    };
    
    bot.editMessageText(
      `*Settings*\n\n• NSFW Content: ${status}\n• Posts Per Page: ${userPreferences[chatId].pagination.limit}`,
      { 
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: options.reply_markup
      }
    );
  }
  else if (data.startsWith("posts_")) {
    // Change posts per page
    const limit = parseInt(data.split("_")[1]);
    userPreferences[chatId].pagination.limit = limit;
    
    // Reset pagination when changing limit
    userPreferences[chatId].pagination.currentPage = 0;
    
    // Update settings message
    const nsfwStatus = userPreferences[chatId].filterNSFW ? "Filtered" : "Allowed";
    
    bot.editMessageText(
      `*Settings*\n\n• NSFW Content: ${nsfwStatus}\n• Posts Per Page: ${limit}`,
      { 
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: `NSFW Content: ${nsfwStatus}`, callback_data: "toggle_nsfw" }],
            [{ text: "Posts Per Page: 3", callback_data: "posts_3" },
             { text: "Posts Per Page: 5", callback_data: "posts_5" },
             { text: "Posts Per Page: 10", callback_data: "posts_10" }]
          ]
        }
      }
    );
    
    // If a subreddit and feed type are already selected, refresh the feed with new limit
    if (userPreferences[chatId].subreddit && userPreferences[chatId].feedType) {
      fetchAndSendPosts(chatId, userPreferences[chatId].subreddit, userPreferences[chatId].feedType);
    }
  }
  else if (data.startsWith("allow_nsfw_")) {
    // Allow NSFW content for this session
    const subreddit = data.split("_")[2];
    userPreferences[chatId].filterNSFW = false;
    
    bot.sendMessage(chatId, "NSFW content filter temporarily disabled. You can manage this in /settings.");
    
    // Show feed type selection
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 Hot", callback_data: `hot_${subreddit}` }],
          [{ text: "🆕 New", callback_data: `new_${subreddit}` }],
          [{ text: "🏆 Top", callback_data: `top_${subreddit}` }],
        ],
      },
    };
    
    bot.sendMessage(chatId, `Choose a feed type for r/${subreddit}:`, options);
  }
  else if (data === "cancel_nsfw") {
    // User canceled viewing NSFW content
    bot.sendMessage(chatId, "Request canceled. Please choose a different subreddit or change your NSFW settings with /settings.");
  }
  else if (data.startsWith("schedule_")) {
    // Handle scheduling
    const [_, subreddit, hour] = data.split("_");
    const feedType = userPreferences[chatId].feedType || "hot";
    
    // Initialize scheduled updates array if it doesn't exist
    if (!scheduledUpdates[chatId]) {
      scheduledUpdates[chatId] = [];
    }
    
    // Add new scheduled update
    scheduledUpdates[chatId].push({
      subreddit,
      feedType,
      hour,
      // In a real application, you would store the actual interval ID here
      // For this demo, we'll just store the schedule details
      intervalId: `${Date.now()}`
    });
    
    bot.sendMessage(
      chatId,
      `✅ You'll receive daily updates from r/${subreddit} (${feedType}) at ${hour}:00.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "View All Schedules", callback_data: "view_schedules" }]
          ]
        }
      }
    );
    
    // Note: In a real application, you would set up actual scheduled tasks here
    // This is simplified for the demo
  }
  else if (data === "cancel_schedule") {
    // User canceled scheduling
    bot.sendMessage(chatId, "Scheduling canceled.");
  }
  else if (data === "view_schedules") {
    // View all scheduled updates (redirects to the command handler)
    const fakeMsg = { chat: { id: chatId }, text: "/viewschedule" };
    bot.onText(/\/viewschedule/, (fakeMsg));
  }
  else if (data.startsWith("cancel_schedule_")) {
    // Cancel specific scheduled update
    const index = parseInt(data.split("_")[2]);
    
    if (scheduledUpdates[chatId] && scheduledUpdates[chatId][index]) {
      // In a real app, you would clear the actual interval here
      // const intervalId = scheduledUpdates[chatId][index].intervalId;
      // clearInterval(intervalId);
      
      // Remove the schedule
      const removedSchedule = scheduledUpdates[chatId].splice(index, 1)[0];
      
      bot.sendMessage(
        chatId,
        `✅ Scheduled updates for r/${removedSchedule.subreddit} at ${removedSchedule.hour}:00 have been canceled.`
      );
    } else {
      bot.sendMessage(chatId, "Could not find the specified schedule.");
    }
  }
  else if (data === "cancel_all_schedules") {
    // Cancel all scheduled updates
    if (scheduledUpdates[chatId] && scheduledUpdates[chatId].length > 0) {
      // In a real app, you would clear all actual intervals here
      /*
      scheduledUpdates[chatId].forEach(schedule => {
        clearInterval(schedule.intervalId);
      });
      */
      
      const count = scheduledUpdates[chatId].length;
      scheduledUpdates[chatId] = [];
      
      bot.sendMessage(
        chatId,
        `✅ All ${count} scheduled updates have been canceled.`
      );
    } else {
      bot.sendMessage(chatId, "You don't have any scheduled updates to cancel.");
    }
  }
});

// Function to fetch and send Reddit posts
async function fetchAndSendPosts(chatId, subreddit, feedType) {
  try {
    // Get user preferences
    const prefs = userPreferences[chatId];
    const currentPage = prefs.pagination.currentPage;
    const limit = prefs.pagination.limit;
    const skipNsfw = prefs.filterNSFW;
    
    // Calculate how many posts to fetch (fetch extra to account for filtered NSFW)
    const fetchLimit = skipNsfw ? limit * 2 : limit;
    const after = currentPage > 0 ? `t3_${prefs.lastPostId}` : null;
    
    // Fetch posts based on feed type
    let listing;
    const options = { limit: fetchLimit + 1 }; // +1 to check if there are more posts
    
    if (after) {
      options.after = after;
    }
    
    switch (feedType) {
      case "hot":
        listing = await reddit.getSubreddit(subreddit).getHot(options);
        break;
      case "new":
        listing = await reddit.getSubreddit(subreddit).getNew(options);
        break;
      case "top":
        listing = await reddit.getSubreddit(subreddit).getTop(options);
        break;
      default:
        bot.sendMessage(chatId, "⚠️ Invalid feed type.");
        return;
    }
    
    // Convert to array if it's not already
    const allPosts = Array.from(listing);
    
    // Filter NSFW content if needed
    let posts = skipNsfw ? allPosts.filter(post => !post.over_18) : allPosts;
    
    // Limit to requested number of posts
    posts = posts.slice(0, limit);
    
    // Check if posts exist
    if (!posts || posts.length === 0) {
      bot.sendMessage(chatId, `⚠️ No${skipNsfw ? " (non-NSFW)" : ""} posts found for r/${subreddit} in ${feedType} feed.`);
      return;
    }
    
    // Save the ID of the last post for pagination
    if (posts.length > 0) {
      prefs.lastPostId = posts[posts.length - 1].id;
    }
    
    // Check if there are more posts
    const hasMore = allPosts.length > limit;
    
    // Send summary message with current page info
    bot.sendMessage(
      chatId, 
      `📱 Showing posts ${currentPage * limit + 1}-${currentPage * limit + posts.length} from r/${subreddit} (${feedType})`
    );
    
    // Send posts to Telegram chat
    for (const post of posts) {
      // Format the message
      let message = `📌 **${post.title}**\n`;
      
      // Add post details
      message += `👤 Posted by u/${post.author.name}\n`;
      message += `⬆️ ${post.score} upvotes | 💬 ${post.num_comments} comments\n\n`;
      
      // Add link
      message += `🔗 [View Post](https://www.reddit.com${post.permalink})`;
      
      // Send message with or without preview based on post type
      const hasMedia = post.is_video || post.post_hint === 'image' || /\.(jpg|jpeg|png|gif)$/i.test(post.url);
      
      await bot.sendMessage(
        chatId,
        message,
        { 
          parse_mode: "Markdown", 
          disable_web_page_preview: !hasMedia 
        }
      );
    }
    
    // Add pagination controls if needed
    const paginationButtons = [];
    
    if (currentPage > 0) {
      paginationButtons.push({ 
        text: "⬅️ Previous", 
        callback_data: `page_prev_${subreddit}_${feedType}` 
      });
    }
    
    if (hasMore) {
      paginationButtons.push({ 
        text: "Next ➡️", 
        callback_data: `page_next_${subreddit}_${feedType}` 
      });
    }
    
    if (paginationButtons.length > 0) {
      bot.sendMessage(
        chatId,
        "Navigate between pages:",
        {
          reply_markup: {
            inline_keyboard: [paginationButtons]
          }
        }
      );
    }
    
  } catch (error) {
    console.error("Reddit API Error:", error);
    bot.sendMessage(
      chatId, 
      `⚠️ Error fetching posts from r/${subreddit}. Please try again later.`
    );
  }
}

// Function to send scheduled updates
// In a real application, you would call this from actual scheduled tasks
async function sendScheduledUpdate(chatId, schedule) {
  try {
    bot.sendMessage(
      chatId,
      `📅 *Scheduled Update*\nHere are the latest posts from r/${schedule.subreddit} (${schedule.feedType}):`,
      { parse_mode: "Markdown" }
    );
    
    // Reset pagination for scheduled updates
    userPreferences[chatId].pagination.currentPage = 0;
    
    // Fetch and send posts
    await fetchAndSendPosts(chatId, schedule.subreddit, schedule.feedType);
  } catch (error) {
    console.error("Scheduled update error:", error);
    bot.sendMessage(
      chatId,
      `⚠️ Error sending scheduled update for r/${schedule.subreddit}.`
    );
  }
}

// Test connection and start the bot
(async function() {
  const connectionSuccessful = await testRedditConnection();
  if (!connectionSuccessful) {
    console.log("WARNING: Reddit API connection failed on startup. Check your credentials.");
  }
  
  // Set up bot commands menu
  await setupBotCommands();
  
  console.log("Telegram bot started and is polling for updates...");
  
  // In a real application, you would set up scheduled tasks here
  // This is simplified for the demo
})();