import { QuotationData, HotelInfo, HotelOption } from '../types';

const limitWords = (text: string, maxWords = 14): string => {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ') + '…';
};

const simple = (text: string): string => {
  // Light simplification: remove arrows and heavy punctuation, keep simple English
  return text
    .replace(/^\s*([\u2192\-•]+)\s*/u, '') // strip leading arrows/bullets
    .replace(/\s*—\s*tickets included\.?$/i, '')
    .replace(/\s*\(.*?\)\s*/g, '') // remove parentheses content
    .replace(/\s+/g, ' ')
    .trim();
};

const totalNights = (hotels?: HotelInfo[], hotelOptions?: HotelOption[]): number => {
  if (hotelOptions && hotelOptions.length > 0) {
    // Choose first option for summary
    return hotelOptions[0].hotels.reduce((sum, h) => sum + (h.nights || 0), 0);
  }
  return (hotels || []).reduce((sum, h) => sum + (h.nights || 0), 0);
};

export const generateQuoteSummaryText = (data: QuotationData): string => {
  const bullets: string[] = [];

  const dest = data.destination ? `Trip to ${data.destination}` : 'Trip summary';
  const duration = data.duration ? `${data.duration}` : '';
  const dates = data.dates ? `(${data.dates})` : '';
  bullets.push(limitWords(`• ${dest}, ${duration} ${dates}`));

  if (data.paxCount || data.numberOfRooms) {
    const paxStr = data.paxCount ? `${data.paxCount} pax` : '';
    const roomStr = data.numberOfRooms ? `${data.numberOfRooms} rooms` : '';
    const joiner = paxStr && roomStr ? '; ' : '';
    bullets.push(limitWords(`• Guests: ${paxStr}${joiner}${roomStr}`));
  }

  if (data.vehicle) {
    // Keep vehicle line concise
    bullets.push(limitWords(`• Vehicle: ${data.vehicle}`));
  }

  const nights = totalNights(data.hotels, data.hotelOptions);
  if (nights > 0) {
    const cat = data.hotelCategory ? `${data.hotelCategory} category` : 'Hotels included';
    bullets.push(limitWords(`• Stay: ${cat}, ${nights} nights`));
  }

  // Key highlights: pick 3 concise activity lines from itinerary
  if (data.itinerary && data.itinerary.length > 0) {
    const picks: string[] = [];
    for (const day of data.itinerary) {
      for (const p of day.points) {
        const s = simple(p);
        if (s.length > 0) {
          picks.push(s);
          break; // one per day for brevity
        }
      }
      if (picks.length >= 4) break;
    }
    if (picks.length > 0) {
      for (const p of picks.slice(0, 4)) {
        bullets.push(limitWords(`• ${p}`));
      }
    }
  }

  // Inclusions short line
  if (data.inclusions && data.inclusions.length > 0) {
    bullets.push(limitWords('• Includes tours, transfers, tickets as per itinerary'));
  }

  // Optional pricing line, if available and concise
  if (data.financialBreakdown && data.financialBreakdown.options.length > 0 && data.paxCount) {
    const first = data.financialBreakdown.options[0];
    const perPerson = Math.round((first.landBaseCost + first.landGST + first.landTCS + first.addOnCost));
    bullets.push(limitWords(`• Pricing: options available; est. ₹${perPerson}/person`));
  }

  // Fallback to overall amount if set
  if (!data.financialBreakdown && data.totalAmount) {
    bullets.push(limitWords(`• Approx. total: ₹${Math.round(data.totalAmount)}`));
  }

  // Final tip to keep it WhatsApp-friendly
  // Avoid exceeding ~8 bullets
  return bullets.slice(0, 8).join('\n');
};