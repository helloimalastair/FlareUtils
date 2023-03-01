export declare interface MailChannelsEmailAddress {
  email: string;
  name?: string;
}
export declare interface MailChannelsBodyObjects {
  type: string;
  value: string;
}
export declare interface MailChannelsHeaders {
  [key: string]: string;
}

export declare interface MailChannelsPersonalizations {
  to: MailChannelsEmailAddress[];
  from: MailChannelsEmailAddress;
  reply_to: MailChannelsEmailAddress;
  cc?: MailChannelsEmailAddress[];
  bcc?: MailChannelsEmailAddress[];
  subject?: string;
  dkim_domain?: string;
  dkim_private_key?: string;
  dkim_selector?: string;
  headers?: MailChannelsHeaders;
}
export declare interface MailChannelsOptions {
  personalizations?: MailChannelsPersonalizations;
  from: MailChannelsEmailAddress;
  reply_to?: MailChannelsEmailAddress;
  subject?: string;
  content?: MailChannelsBodyObjects[];
  headers?: MailChannelsHeaders;
}


/**
 * Helper to quickly send emails with the MailChannels API.
 * @note This helper function performs no verification of your inputs, and should only be used for utilizing types with MailChannels.
 * @param {MailChannelsOptions} opts Options that the MailChannels API may accept when sending an email.
 * @returns {Promise<Response>} Response from the MailChannels API.
 * @example ```ts
 * await sendMail({from: {email: "user@example.com"}, content: [{type: "text/plain", value: "Hello, world!"}]});
 * ```
 */
export async function sendMail(opts: MailChannelsOptions): Promise<Response> {
  return fetch("https://api.mailchannels.net/tx/v1/send", {
    headers: {
      "content-type": "application/json",
      "accept": "application/json"
    },
    method: "POST",
    body: JSON.stringify(opts),
  });
}