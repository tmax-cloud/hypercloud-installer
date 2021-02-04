/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import YAML from 'yaml';
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import * as Common from '../../common/common';
import Node from '../Node';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class HyperCloudWebhookInstaller extends AbstractInstaller {
  public static readonly IMAGE_DIR = `install-hypercloud`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/install-hypercloud`;

  public static readonly IMAGE_HOME = `${Env.INSTALL_ROOT}/${HyperCloudWebhookInstaller.IMAGE_DIR}`;

  public static readonly HPCD_WEBHOOK_VERSION = `4.1.0.22`;

  // singleton
  private static instance: HyperCloudWebhookInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!HyperCloudWebhookInstaller.instance) {
      HyperCloudWebhookInstaller.instance = new HyperCloudWebhookInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
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

  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      await this.downloadImageFile();
      await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      await this.registryWork({
        callback
      });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  protected async downloadImageFile() {
    // TODO: download image file
    console.debug(
      '@@@@@@ Start downloading the image file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the image file to client local... ######'
    );
  }

  protected async sendImageFile() {
    console.debug(
      '@@@@@@ Start sending the image file to main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${HyperCloudWebhookInstaller.IMAGE_DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${HyperCloudWebhookInstaller.IMAGE_HOME}/`
    );
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

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
    mainMaster.cmd = script.cloneGitFile(
      CONST.HYPERCLOUD_REPO,
      CONST.GIT_BRANCH
    );
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  protected async registryWork(param: { callback: any }) {
    console.debug(
      '@@@@@@ Start pushing the image at main master node... @@@@@@'
    );
    const { callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this.getImagePushScript();
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(): string {
    let gitPullCommand = `
  mkdir -p ~/${HyperCloudWebhookInstaller.IMAGE_HOME};
  export WEBHOOK_HOME=~/${HyperCloudWebhookInstaller.IMAGE_HOME};
  export HPCD_WEBHOOK_VERSION=${HyperCloudWebhookInstaller.HPCD_WEBHOOK_VERSION};
  export REGISTRY=${this.env.registry};
  cd $WEBHOOK_HOME;
  `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
    sudo docker load < hypercloud-webhook_b\${HPCD_WEBHOOK_VERSION}.tar;
    `;
    } else {
      gitPullCommand += `
    sudo docker pull tmaxcloudck/hypercloud-webhook:b\${HPCD_WEBHOOK_VERSION};
    `;
    }
    return `
    ${gitPullCommand}
    sudo docker tag tmaxcloudck/hypercloud-webhook:b\${HPCD_WEBHOOK_VERSION} \${REGISTRY}/hypercloud-webhook:b\${HPCD_WEBHOOK_VERSION};

    sudo docker push \${REGISTRY}/hypercloud-webhook:b\${HPCD_WEBHOOK_VERSION}
    #rm -rf $WEBHOOK_HOME;
    `;
  }

  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing webhook main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 1. Secret 생성
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    // Step 2. hypercloud-webhook yaml 수정
    mainMaster.cmd = this._step2();
    await mainMaster.exeCmd(callback);

    // Step 3. HyperCloud Webhook Server 배포
    mainMaster.cmd = this._step3();
    await mainMaster.exeCmd(callback);

    // Step 4. HyperCloud Webhook Config 생성 및 적용
    mainMaster.cmd = this._step4();
    await mainMaster.exeCmd(callback);

    // Step 5. HyperCloud Audit Webhook Config 생성
    mainMaster.cmd = this._step5();
    await mainMaster.exeCmd(callback);

    // Webhook Config 다른 마스터들에게 복사
    mainMaster.cmd = this._cpConfigtoMaster();
    await mainMaster.exeCmd(callback);

    // Step 6. HyperCloud Audit Webhook Config 적용
    await this._step6();

    // Step 7. test-yaml 배포
    mainMaster.cmd = this._step7();
    await mainMaster.exeCmd(callback);

    console.debug('###### Finish installing webhook main Master... ######');
  }

  private _step1() {
    return `
    ${this._exportEnv()}
    cd \${HPCD_HOME}
    mv manifest/hypercloud-webhook manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}
    kubectl -n hypercloud4-system create secret generic hypercloud4-webhook-certs --from-file=\${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/pki/hypercloud4-webhook.jks
    `;
  }

  private _step2() {
    let script = `
    ${this._exportEnv()}
    sed -i 's/{HPCD_WEBHOOK_VERSION}/b'\${HPCD_WEBHOOK_VERSION}'/g'  \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/01_webhook-deployment.yaml
    `;

    if (this.env.registry) {
      script += `
      sed -i 's/tmaxcloudck\\/hypercloud-webhook/'\${REGISTRY}'\\/tmaxcloudck\\/hypercloud-webhook/g' \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/01_webhook-deployment.yaml
      `;
    }
    return script;
  }

  private _step3() {
    let script = `${this._exportEnv()}`;

    // 개발 환경에서는 테스트 시, POD의 메모리를 조정하여 테스트
    if (process.env.RESOURCE === 'low') {
      script += `
      sed -i 's/memory: "1Gi"/memory: "500Mi"/g' \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/01_webhook-deployment.yaml;
      `;
    }
    script += `
    kubectl apply -f  \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/01_webhook-deployment.yaml;
    `;

    return script;
  }

  private _step4() {
    return `
    ${this._exportEnv()}
    chmod +x \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/*.sh
    sh  \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/02_gen-webhook-config.sh
    kubectl apply -f  \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/03_webhook-configuration.yaml
    `;
  }

  private _step5() {
    return `
    ${this._exportEnv()}
    sh \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/04_gen-audit-config.sh
    cp \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/05_audit-webhook-config /etc/kubernetes/pki/audit-webhook-config
    cp \${HPCD_HOME}/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION}/06_audit-policy.yaml /etc/kubernetes/pki/audit-policy.yaml
    `;
  }

  private _cpConfigtoMaster() {
    const { masterArr } = this.env.getNodesSortedByRole();
    let copyScript = '';
    masterArr.map(master => {
      copyScript += `
      sshpass -p '${master.password}' scp -P ${master.port} -o StrictHostKeyChecking=no ./05_audit-webhook-config ${master.user}@${master.ip}:/etc/kubernetes/pki/audit-webhook-config;
      sshpass -p '${master.password}' scp -P ${master.port} -o StrictHostKeyChecking=no ./06_audit-policy.yaml ${master.user}@${master.ip}:/etc/kubernetes/pki/audit-policy.yaml;
      `;
    });

    return `
    ${this._exportEnv()}
    cd ~/${
      HyperCloudWebhookInstaller.INSTALL_HOME
    }/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION};
    ${copyScript}
    `;
  }

  private async _step6() {
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();

    mainMaster.cmd = `cat /etc/kubernetes/manifests/kube-apiserver.yaml;`;
    let apiServerYaml: any;
    await mainMaster.exeCmd({
      close: () => {},
      stdout: (data: string) => {
        apiServerYaml = YAML.parse(data.toString());
      },
      stderr: () => {}
    });
    console.error('apiServerYaml', apiServerYaml);
    apiServerYaml.spec.containers[0].command.push(
      `--audit-log-path=/var/log/kubernetes/apiserver/audit.log`
    );
    apiServerYaml.spec.containers[0].command.push(
      `--audit-policy-file=/etc/kubernetes/pki/audit-policy.yaml`
    );
    apiServerYaml.spec.containers[0].command.push(
      `--audit-webhook-config-file=/etc/kubernetes/pki/audit-webhook-config`
    );
    apiServerYaml.spec.dnsPolicy = 'ClusterFirstWithHostNet';

    console.error('apiServerYaml stringify', YAML.stringify(apiServerYaml));
    mainMaster.cmd = `
    echo "${YAML.stringify(
      apiServerYaml
    )}" > /etc/kubernetes/manifests/kube-apiserver.yaml;
    `;
    await mainMaster.exeCmd();

    await Common.waitApiServerUntilNormal(mainMaster);

    // 다른 마스터에도 적용
    await Promise.all(
      masterArr.map(async (master: Node) => {
        master.cmd = `cat /etc/kubernetes/manifests/kube-apiserver.yaml;`;
        await master.exeCmd({
          close: () => {},
          stdout: (data: string) => {
            apiServerYaml = YAML.parse(data.toString());
          },
          stderr: () => {}
        });
        console.error('apiServerYaml', apiServerYaml);
        apiServerYaml.spec.containers[0].command.push(
          `--audit-log-path=/var/log/kubernetes/apiserver/audit.log`
        );
        apiServerYaml.spec.containers[0].command.push(
          `--audit-policy-file=/etc/kubernetes/pki/audit-policy.yaml`
        );
        apiServerYaml.spec.containers[0].command.push(
          `--audit-webhook-config-file=/etc/kubernetes/pki/audit-webhook-config`
        );
        apiServerYaml.spec.dnsPolicy = 'ClusterFirstWithHostNet';

        console.error('apiServerYaml stringify', YAML.stringify(apiServerYaml));
        master.cmd = `
        echo "${YAML.stringify(
          apiServerYaml
        )}" > /etc/kubernetes/manifests/kube-apiserver.yaml;
        `;
        await master.exeCmd();
      })
    );
  }

  private _step7() {
    return `
    ${this._exportEnv()}
    # cd ~/${
      HyperCloudWebhookInstaller.INSTALL_HOME
    }/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION};
    # kubectl apply -f test-yaml/namespaceclaim.yaml;
    `;
  }

  private _exportEnv() {
    return `
    export HPCD_HOME=~/${HyperCloudWebhookInstaller.INSTALL_HOME};
    export HPCD_WEBHOOK_VERSION=${HyperCloudWebhookInstaller.HPCD_WEBHOOK_VERSION};
    export REGISTRY=${this.env.registry};
    `;
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove webhook main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove webhook main Master... ######');
  }

  private _getRemoveScript(): string {
    // hypercloud operator 삭제 할 때, git repo 폴더 삭제
    return `
        ${this._exportEnv()}
    cd ~/${
      HyperCloudWebhookInstaller.INSTALL_HOME
    }/manifest/hypercloud-webhook-\${HPCD_WEBHOOK_VERSION};
    # kubectl delete -f test-yaml/namespaceclaim.yaml;
    kubectl delete -f 03_webhook-configuration.yaml;
    kubectl delete -f 01_webhook-deployment.yaml;
    `;
  }

  public async rollbackApiServerYaml() {
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();

    const targetList = [...masterArr, mainMaster];

    await Promise.all(
      targetList.map(async node => {
        node.cmd = `cat /etc/kubernetes/manifests/kube-apiserver.yaml;`;
        let apiServerYaml;
        await node.exeCmd({
          close: () => {},
          stdout: (data: string) => {
            apiServerYaml = YAML.parse(data.toString());
          },
          stderr: () => {}
        });
        console.error('apiServerYaml', apiServerYaml);
        apiServerYaml.spec.containers[0].command = apiServerYaml.spec.containers[0].command.filter(
          (cmd: string | string[]) => {
            return cmd.indexOf('--audit') === -1;
          }
        );
        delete apiServerYaml.spec.dnsPolicy;

        console.error('apiServerYaml stringify', YAML.stringify(apiServerYaml));
        node.cmd = `
        echo "${YAML.stringify(
          apiServerYaml
        )}" > /etc/kubernetes/manifests/kube-apiserver.yaml;
        `;
        await node.exeCmd();
      })
    );
  }
}
