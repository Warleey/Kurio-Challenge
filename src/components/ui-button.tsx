import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {clsx} from 'clsx';
type Props=React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'outline'|'ghost';asChild?:boolean};
export const Button=React.forwardRef<HTMLButtonElement,Props>(function Button({variant='primary',asChild=false,className,...props},ref){const C=asChild?Slot:'button';return <C ref={ref} className={clsx('button',variant,className)} {...props}/>});
