import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './ui/command';
import { Button } from './ui/button';
import { Check, ChevronDown, Search } from 'lucide-react';

const ItemCodeSearchInput = ({ items = [], onSelect, placeholder = 'Search item by code / name...' }) => {
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState('');

  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <div className="flex items-center gap-2 text-left truncate">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className={selectedName ? '' : 'text-muted-foreground'}>{selectedName || placeholder}</span>
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search..." />
          <CommandList>
            <CommandEmpty>No items found.</CommandEmpty>
            <CommandGroup>
              {sorted.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.name}
                  onSelect={() => {
                    setSelectedName(it.name);
                    onSelect?.(it);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${selectedName === it.name ? 'opacity-100' : 'opacity-0'}`} />
                  <div className="flex flex-col">
                    <span className="font-medium">{it.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {it.category_name || 'Uncategorized'} • S:{Math.round(it.sheets)} U:{Math.round(it.uMolding)} L:{Math.round(it.lMolding)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ItemCodeSearchInput;
