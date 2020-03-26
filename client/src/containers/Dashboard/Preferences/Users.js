import React from 'react';
import {
  Tabs,
  Tab,
  Button,
  Intent,
} from '@blueprintjs/core';
import { useHistory } from 'react-router-dom';
import PreferencesSubContent from 'components/Preferences/PreferencesSubContent';
import connector from 'connectors/UsersPreferences.connector';

function UsersPreferences({
  openDialog,
}) {
  const history = useHistory();
  const onChangeTabs = (currentTabId) => {

  };

  const onClickNewUser = () => {
    openDialog('user-form');
  };
  return (
    <div class="preferences__inside-content preferences__inside-content--users-roles">
      <div class="preferences__tabs">
        <Tabs
          animate={true}
          large={true}
          onChange={onChangeTabs}>
          <Tab id="users" title="Users" />
          <Tab id="roles" title="Roles" />
        </Tabs>

        <div class="preferences__tabs-extra-actions">
          <Button
            intent={Intent.PRIMARY}
            onClick={onClickNewUser}>New User</Button>

          <Button
            intent={Intent.PRIMARY}
            onClick={onClickNewUser}>New Role</Button>
        </div>
      </div>
      <PreferencesSubContent preferenceTab="users" />
    </div>
  );
}

export default connector(UsersPreferences);