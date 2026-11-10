import campaignsRoutes from '../campaigns.routes';
import { routeIsAccessibleFor } from 'dashboard/helper/routeHelpers';

const childRoutes = campaignsRoutes.routes[0].children.filter(
  route => route.meta
);

describe('campaigns routes', () => {
  it.each(childRoutes.map(route => [route.name, route]))(
    '%s is open to administrators and campaign managers only',
    (_name, route) => {
      expect(routeIsAccessibleFor(route, ['administrator'])).toBe(true);
      expect(routeIsAccessibleFor(route, ['agent', 'campaign_manage'])).toBe(
        true
      );
      expect(routeIsAccessibleFor(route, ['agent'])).toBe(false);
      expect(
        routeIsAccessibleFor(route, ['contact_manage', 'custom_role'])
      ).toBe(false);
    }
  );
});
