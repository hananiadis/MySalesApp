describe('getBrandModuleRoute', () => {
  it('maps each brand key to the correct main tab route', () => {
    const { getBrandModuleRoute } = require('../src/constants/brands');

    expect(getBrandModuleRoute('playmobil')).toBe('PlaymobilModule');
    expect(getBrandModuleRoute('kivos')).toBe('KivosModule');
    expect(getBrandModuleRoute('john')).toBe('JohnModule');
    expect(getBrandModuleRoute('unknown')).toBe('PlaymobilModule');
  });
});
