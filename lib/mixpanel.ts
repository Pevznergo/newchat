import Mixpanel from "mixpanel";

let mixpanel: Mixpanel.Mixpanel | null = null;

if (process.env.MIXPANEL_TOKEN) {
	mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);
}

export const trackBackendEvent = (
	eventName: string,
	distinctId: string,
	properties?: Record<string, any>,
) => {
	if (mixpanel) {
		try {
			mixpanel.track(eventName, {
				distinct_id: distinctId,
				...properties,
			});
		} catch (e) {
			console.error("Mixpanel backend track error", e);
		}
	}
};

export const identifyBackendUser = (
	distinctId: string,
	properties?: Record<string, any>,
) => {
	if (mixpanel && properties) {
		try {
			mixpanel.people.set(distinctId, properties);
		} catch (e) {
			console.error("Mixpanel backend identify error", e);
		}
	}
};
