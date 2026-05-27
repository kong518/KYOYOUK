import handler from "../server";

export default handler;

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

