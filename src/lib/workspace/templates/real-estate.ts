import type { WorkspaceBlueprintInput } from '../blueprint'

/** Real-estate agency — properties, viewings, offers. */
export const realEstateBlueprint: WorkspaceBlueprintInput = {
  profile: {
    industryKey: 'real-estate',
    industryLabel: 'Real estate agency',
    businessModel: 'Commission per transaction',
  },
  terminology: {
    contact: { singular: 'Client', plural: 'Clients' },
  },
  objects: [
    {
      key: 'property',
      singular: 'Property',
      plural: 'Properties',
      icon: 'home',
      description: 'Listings from first publication to closing.',
      fields: [
        { key: 'address', label: 'Address', type: 'TEXT', required: true },
        { key: 'price', label: 'Price', type: 'MONEY' },
        { key: 'area_sqm', label: 'Area (m²)', type: 'NUMBER' },
        { key: 'bedrooms', label: 'Bedrooms', type: 'NUMBER', showInList: false },
        { key: 'seller_name', label: 'Seller', type: 'TEXT', showInList: false },
        { key: 'listing_url', label: 'Listing link', type: 'URL', showInList: false },
        { key: 'description', label: 'Description', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'listed', label: 'Listed' },
        { key: 'viewings', label: 'Viewings' },
        { key: 'offer_received', label: 'Offer received' },
        { key: 'under_contract', label: 'Under contract' },
        { key: 'sold', label: 'Sold', terminal: true },
        { key: 'withdrawn', label: 'Withdrawn', terminal: true },
      ],
    },
    {
      key: 'viewing',
      singular: 'Viewing',
      plural: 'Viewings',
      icon: 'key',
      description: 'Scheduled showings and buyer feedback.',
      fields: [
        { key: 'property_address', label: 'Property', type: 'TEXT', required: true },
        { key: 'buyer_name', label: 'Buyer', type: 'TEXT', required: true },
        { key: 'scheduled_at', label: 'When', type: 'DATETIME', required: true },
        { key: 'feedback', label: 'Feedback', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'confirmed', label: 'Confirmed' },
        { key: 'completed', label: 'Completed', terminal: true },
        { key: 'cancelled', label: 'Cancelled', terminal: true },
      ],
    },
    {
      key: 'offer',
      singular: 'Offer',
      plural: 'Offers',
      icon: 'handshake',
      description: 'Purchase offers under negotiation.',
      fields: [
        { key: 'property_address', label: 'Property', type: 'TEXT', required: true },
        { key: 'buyer_name', label: 'Buyer', type: 'TEXT', required: true },
        { key: 'amount', label: 'Amount', type: 'MONEY', required: true },
        { key: 'financing', label: 'Financing', type: 'SELECT', options: ['Cash', 'Mortgage', 'Mixed'] },
        { key: 'expires', label: 'Expires', type: 'DATE', showInList: false },
      ],
      pipeline: [
        { key: 'submitted', label: 'Submitted' },
        { key: 'countered', label: 'Countered' },
        { key: 'accepted', label: 'Accepted', terminal: true },
        { key: 'declined', label: 'Declined', terminal: true },
        { key: 'withdrawn', label: 'Withdrawn', terminal: true },
      ],
    },
  ],
  dashboard: [
    { type: 'stage-breakdown', objectKey: 'property', label: 'Property pipeline' },
    { type: 'object-count', objectKey: 'viewing', label: 'Viewings' },
    { type: 'stage-breakdown', objectKey: 'offer', label: 'Offers' },
  ],
  copilot: {
    title: 'Real-estate copilot',
    style: 'Responsive and market-savvy; think in listings, viewings and offers; speed and follow-up win deals.',
    focus: ['Buyer matching', 'Listing descriptions', 'Viewing follow-ups', 'Offer negotiations'],
  },
  automationIdeas: [
    'Follow up with every buyer within a day of their viewing',
    'Flag listings with no viewings for two weeks',
    'Draft listing copy from the property record',
    'Send sellers a weekly activity report',
    'Alert when an offer is about to expire',
  ],
}
