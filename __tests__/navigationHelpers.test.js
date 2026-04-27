describe('navigateToMainHome', () => {
  it('uses the highest navigator that can reach MainHome', () => {
    const topNavigate = jest.fn();
    const topNavigator = {
      navigate: topNavigate,
      getState: () => ({ routeNames: ['MainHome', 'PlaymobilModule'] }),
      getParent: () => undefined,
    };

    const brandNavigator = {
      navigate: jest.fn(),
      getState: () => ({ routeNames: ['BrandHome', 'Products', 'Customers'] }),
      getParent: () => topNavigator,
    };

    const { navigateToMainHome } = require('../src/utils/navigationHelpers');

    const handled = navigateToMainHome(brandNavigator);

    expect(handled).toBe(true);
    expect(topNavigate).toHaveBeenCalledWith('MainHome');
    expect(brandNavigator.navigate).not.toHaveBeenCalled();
  });
});
