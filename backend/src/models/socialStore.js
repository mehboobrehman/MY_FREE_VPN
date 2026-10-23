// RAM-only ephemeral storage for social network posts, comments, and moderation flags
const posts = new Map(); // post_id -> post object
const comments = new Map(); // comment_id -> comment object
const flags = new Map(); // flag_id -> flag object

// Automated moderation banned words / patterns
const bannedWords = ['spam', 'malware', 'scam', 'phishing', 'abuse', 'hack'];

function moderateContent(text) {
  const lower = text.toLowerCase();
  for (const word of bannedWords) {
    if (lower.includes(word)) {
      return { flagged: true, reason: `Contains prohibited keyword: ${word}` };
    }
  }
  return { flagged: false, reason: null };
}

module.exports = {
  posts,
  comments,
  flags,
  moderateContent
};
