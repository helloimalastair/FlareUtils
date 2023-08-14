# MailChannels

Simple `fetch` wrapper to help you quickly send emails with the [MailChannels API](https://mailchannels.zendesk.com/hc/en-us/articles/4565898358413-Sending-Email-from-Cloudflare-Workers-using-MailChannels-Send-API).

This setup, or any setup to send emails, should not be utilized without a proper DKIM setup. For a tutorial on how to configure DKIM with Workers, see the [MailChannels docs](https://mailchannels.zendesk.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature).

::: warning
In an effort to be concise, this helper function performs no verification of your inputs, and should only be used for utilizing types with MailChannels.
:::

```ts
import { sendMail } from "flareutils";

export default <ExportedHandler>{
	async fetch(req) {
		await sendMail({
			from: {
				name: "John Foobar",
				email: "john@foobar.baz",
			},
			personalizations: {
				to: [
					{
						name: "Jane Foobar",
						email: "jane@foobar.baz",
					},
				],
				subject: "Where do I find that blue shark plushy?",
			},
			content: [
				{
					type: "text/plain",
					value:
						"I've been looking for that blue shark plushy for ages, but I can't find it anywhere. Do you know where I can find it?",
				},
			],
		});
		// ...
	},
};
```
