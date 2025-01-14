// @ts-nocheck
import { useFormikContext } from 'formik';
import { FFormGroup } from '@/components';
import { CompanyLogoUpload } from './CompanyLogoUpload';

export function BrandingCompanyLogoUploadField() {
  const { setFieldValue, values } = useFormikContext();

  return (
    <FFormGroup name={'companyLogo'} label={''} fastField>
      <CompanyLogoUpload
        initialPreview={values.companyLogoUri}
        onChange={(file) => {
          const imageUrl = file ? URL.createObjectURL(file) : '';

          setFieldValue('_companyLogoFile', file);
          setFieldValue('companyLogoUri', imageUrl);
        }}
      />
    </FFormGroup>
  );
}
