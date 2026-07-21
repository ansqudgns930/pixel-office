export interface CompanyOptionLike { id: string; name: string; status?: string }

export function isGeneratedTestCompany(company: CompanyOptionLike): boolean {
  const text = (company.id + ' ' + company.name).toLowerCase();
  return text.includes('delegated-work-flow-qa')
    || text.includes('delegated work flow qa')
    || text.includes('ui 전용 전체여정')
    || text.includes('ui 전체흐름')
    || /^test company$/i.test(company.name.trim())
    || /^test[-_s]/i.test(company.id.trim());
}

export function userFacingCompanyOptions<T extends CompanyOptionLike>(companies: T[], currentId = ''): T[] {
  return companies.filter(company => company.id === currentId || !isGeneratedTestCompany(company));
}

export function hiddenCompanyCount(companies: CompanyOptionLike[], currentId = ''): number {
  return companies.filter(company => company.id !== currentId && isGeneratedTestCompany(company)).length;
}
