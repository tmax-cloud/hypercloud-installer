/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class TemplateSeviceBrokerInstaller extends AbstractInstaller {
  public static readonly DIR = `install-tsb`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${TemplateSeviceBrokerInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${TemplateSeviceBrokerInstaller.INSTALL_HOME}/image`;

  public static readonly TEMPLATE_VERSION = `0.0.5`;

  public static readonly TEMPLATE_NAMESPACE = `template`;

  public static readonly CLUSTER_TSB_VERSION = `0.0.5`;

  public static readonly TSB_VERSION = `0.0.5`;

  public static readonly CLUSTER_TSB_NAMESPACE = `cluster-tsb-ns`;

  public static readonly TSB_NAMESPACE = `tsb-ns`;

  // singleton
  private static instance: TemplateSeviceBrokerInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!TemplateSeviceBrokerInstaller.instance) {
      TemplateSeviceBrokerInstaller.instance = new TemplateSeviceBrokerInstaller();
    }
    return this.instance;
  }

  public async install(param: { callback: any; setProgress: Function }) {
    const { callback } = param;

    await this.preWorkInstall({
      callback
    });

    await this._installMainMaster(callback);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  // protected abstract 구현
  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      // await this.downloadImageFile();
      // await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
      // TODO: downloadYamlAtLocal();
      // TODO: sendYaml();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
      // await this._downloadYaml();
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      // await this.registryWork({
      //   callback
      // });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  // protected async downloadImageFile() {
  //   // TODO: download image file
  //   console.debug(
  //     '@@@@@@ Start downloading the image file to client local... @@@@@@'
  //   );
  //   console.debug(
  //     '###### Finish downloading the image file to client local... ######'
  //   );
  // }

  // protected async sendImageFile() {
  //   console.debug(
  //     '@@@@@@ Start sending the image file to main master node... @@@@@@'
  //   );
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${TemplateSeviceBrokerInstaller.DIR}/`;
  //   await scp.sendFile(
  //     mainMaster,
  //     srcPath,
  //     `${TemplateSeviceBrokerInstaller.IMAGE_HOME}/`
  //   );
  //   console.debug(
  //     '###### Finish sending the image file to main master node... ######'
  //   );
  // }

  protected downloadGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected sendGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    // FIXME: tsb git branch명 통일되지 않음
    mainMaster.cmd = script.cloneGitFile(CONST.TSB_REPO, 'tsb-5.0');
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  // protected async registryWork(param: { callback: any }) {
  //   console.debug(
  //     '@@@@@@ Start pushing the image at main master node... @@@@@@'
  //   );
  //   const { callback } = param;
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = this.getImagePushScript();
  //   await mainMaster.exeCmd(callback);
  //   console.debug(
  //     '###### Finish pushing the image at main master node... ######'
  //   );
  // }

  // protected getImagePushScript(): string {
  //   let gitPullCommand = `
  //   mkdir -p ~/${TemplateSeviceBrokerInstaller.IMAGE_HOME};
  //   export TSB_HOME=~/${TemplateSeviceBrokerInstaller.IMAGE_HOME};
  //   export TSB_VERSION=v${TemplateSeviceBrokerInstaller.VERSION};
  //   export REGISTRY=${this.env.registry};
  //   cd $TSB_HOME;
  //   `;
  //   if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
  //     gitPullCommand += `
  //     docker load < template-service-broker_b\${TSB_VERSION}.tar
  //     `;
  //   } else {
  //     gitPullCommand += `
  //     docker pull tmaxcloudck/template-service-broker:b\${TSB_VERSION}

  //     #docker save tmaxcloudck/template-service-broker:b\${TSB_VERSION} > template-service-broker_b\${TSB_VERSION}.tar
  //     `;
  //   }
  //   return `
  //     ${gitPullCommand}
  //     docker tag tmaxcloudck/template-service-broker:b\${TSB_VERSION} \${REGISTRY}/tmaxcloudck/template-service-broker:b\${TSB_VERSION}

  //     docker push \${REGISTRY}/tmaxcloudck/template-service-broker:b\${TSB_VERSION}
  //     #rm -rf $TSB_HOME;
  //     `;
  // }

  private async _installMainMaster(callback: any) {
    console.debug(
      '@@@@@@ Start installing template service broker main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step0. tsb.config 설정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // Step1. install-template
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    // Step2. install-cluster-tsb
    mainMaster.cmd = this._step2();
    await mainMaster.exeCmd(callback);

    // Step3. install-tsb
    mainMaster.cmd = this._step3();
    await mainMaster.exeCmd(callback);

    // Step4. register-cluster-tsb
    mainMaster.cmd = this._step4();
    await mainMaster.exeCmd(callback);

    // Step5. register-tsb
    mainMaster.cmd = this._step5();
    await mainMaster.exeCmd(callback);

    console.debug(
      '###### Finish installing template service broker main Master... ######'
    );
  }

  private _step0() {
    let script = `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo sed -i 's|\\r$||g' tsb.config;
    . tsb.config;

    # sudo sed -i "s|$templateVersion|${TemplateSeviceBrokerInstaller.TEMPLATE_VERSION}|g" ./tsb.config;
    # sudo sed -i "s|$templateNamespace|${TemplateSeviceBrokerInstaller.TEMPLATE_NAMESPACE}|g" ./tsb.config;
    # sudo sed -i "s|$clusterTsbVersion|${TemplateSeviceBrokerInstaller.CLUSTER_TSB_VERSION}|g" ./tsb.config;
    # sudo sed -i "s|$tsbVersion|${TemplateSeviceBrokerInstaller.TSB_VERSION}|g" ./tsb.config;
    # sudo sed -i "s|$clusterTsbNamespace|${TemplateSeviceBrokerInstaller.CLUSTER_TSB_NAMESPACE}|g" ./tsb.config;
    # sudo sed -i "s|$tsbNamespace|${TemplateSeviceBrokerInstaller.TSB_NAMESPACE}|g" ./tsb.config;
  `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$imageRegistry|${this.env.registry}|g" ./tsb.config;`;
    }

    return script;
  }

  private _step1() {
    return `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-tsb.sh install-template;
    `;
  }

  private _step2() {
    return `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-tsb.sh install-cluster-tsb;
    `;
  }

  private _step3() {
    return `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-tsb.sh install-tsb;
    `;
  }

  private _step4() {
    return `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-tsb.sh register-cluster-tsb;
    `;
  }

  private _step5() {
    return `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-tsb.sh register-tsb;
    `;
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove console main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME}/manifest;
    sudo ./install-tsb.sh uninstall-template;
    sudo ./install-tsb.sh uninstall-cluster-tsb;
    sudo ./install-tsb.sh uninstall-tsb;
    sudo ./install-tsb.sh unregister-cluster-tsb;
    sudo ./install-tsb.sh unregister-tsb;
    rm -rf ~/${TemplateSeviceBrokerInstaller.INSTALL_HOME};
    `;
  }
}
