
module.exports = (req, res) => {
  res.status(200).json({ key: process.env.GOOGLE_API_KEY });
};
