import { HOTEL_BANNER_BASE64, PARTNER_BANNER_BASE64, BEST_RATE_BADGE_BASE64, TRIP_EXPLORE_RATED_BASE64, CALL_BUTTON_BASE64, WHATSAPP_BUTTON_BASE64 } from '../assets/localImages';

const NEW_HEADER_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1765680866/Trip-Explore-Banner_ejp9hh.png";
const TOP_HEADER_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1765683665/Gemini_Generated_Image_wniw9nwniw9nwniw_e0awo6.png";

const fetchImageBase64 = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn(`Could not fetch image from ${url}`, e);
        return null;
    }
};

export const getHotelBannerBase64 = async () => {
    const remote = await fetchImageBase64(NEW_HEADER_URL);
    return remote || HOTEL_BANNER_BASE64;
};

export const getTopHeaderImageBase64 = async () => {
    // If fetch fails, return null so we don't render a broken image
    return await fetchImageBase64(TOP_HEADER_URL);
};

export const getPartnerBannerBase64 = async () => {
    return PARTNER_BANNER_BASE64;
};

export const getBestRateBadgeBase64 = async () => {
    return BEST_RATE_BADGE_BASE64;
};

export const getTripExploreRatedBase64 = async () => {
    return TRIP_EXPLORE_RATED_BASE64;
};

const CALL_BUTTON_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1767504923/Call-Now-Button_gq6urr.png";
const WHATSAPP_BUTTON_URL = "https://res.cloudinary.com/dnauowwb0/image/upload/v1767504923/Whatsapp-Button_kuwlcf.png";

export const getCallButtonBase64 = async () => {
    const remote = await fetchImageBase64(CALL_BUTTON_URL);
    return remote || CALL_BUTTON_BASE64;
};

export const getWhatsappButtonBase64 = async () => {
    const remote = await fetchImageBase64(WHATSAPP_BUTTON_URL);
    return remote || WHATSAPP_BUTTON_BASE64;
};